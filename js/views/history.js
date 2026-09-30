// 履歴画面：日付ごとの一覧（#history）と、その日の詳細（#history/セッションid）。

import { loadAll, removeSession } from '../db.js';
import { h, clear, button, confirmDialog, toast } from '../ui/dom.js';
import { editSessionDate, editSet } from '../ui/editors.js';
import { compareSessions, compareSets } from '../logic/progression.js';
import { sessionSummaries } from '../logic/stats.js';
import { PART_LABEL } from '../defaults.js';
import { formatDate, fmtNum, fmtSet, parseDate } from '../util.js';

export const title = '履歴';

export async function render(root) {
  const id = decodeURIComponent(location.hash.split('/')[1] ?? '');
  const data = await loadAll();
  const session = id ? data.sessions.find((s) => s.id === id) : null;
  clear(root).append(session ? detail(data, session, () => render(root)) : list(data));
}

function list(data) {
  const exName = new Map(data.exercises.map((e) => [e.id, e.name]));
  const rows = sessionSummaries(data).sort((a, b) => compareSessions(b.session, a.session));
  if (rows.length === 0) return h('p', { class: 'muted' }, 'まだ記録がありません。記録画面で「今日のトレーニング開始」を押すと始まります。');

  // 月ごとに区切る
  const groups = [];
  for (const r of rows) {
    const d = parseDate(r.session.date);
    const month = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (groups.at(-1)?.month !== month) groups.push({ month, rows: [] });
    groups.at(-1).rows.push(r);
  }
  return h('div', {}, groups.map((g) => [
    h('h2', { class: 'section-title' }, g.month),
    h('ul', { class: 'list card list-card' }, g.rows.map((r) => h('li', {},
      h('a', { class: 'list-item list-link', href: `#history/${encodeURIComponent(r.session.id)}` },
        h('div', { class: 'list-main' },
          h('div', { class: 'name' }, formatDate(r.session.date)),
          h('div', { class: 'sub' }, r.exerciseIds.map((id) => exName.get(id) ?? '（削除された種目）').join('・') || '記録なし'),
        ),
        h('span', { class: 'muted small num' }, `${r.setCount}セット`),
        h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'),
      ),
    ))),
  ]));
}

function detail(data, session, rerender) {
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const sets = data.sets.filter((s) => s.sessionId === session.id).sort((a, b) => a.createdAt - b.createdAt);
  // 種目ごとに、その日最初に記録した順で並べる
  const byEx = new Map();
  for (const s of sets) {
    if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
    byEx.get(s.exerciseId).push(s);
  }
  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

  return h('div', {},
    h('div', { class: 'detail-head' },
      h('a', { class: 'btn btn-ghost back-link', href: '#history' }, '‹ 一覧'),
      button(`${formatDate(session.date, true)} ✎`, async () => {
        if (await editSessionDate(session)) rerender();
      }, 'btn-ghost', { 'aria-label': `日付 ${formatDate(session.date, true)}。押すと変更` }),
    ),
    h('p', { class: 'muted small' }, `${sets.length}セット・総負荷量 ${fmtNum(Math.round(volume)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}kg`),
    sets.length === 0 ? h('p', { class: 'muted' }, 'この日の記録はありません') : null,
    [...byEx].map(([exId, exSets]) => {
      const ex = exById.get(exId);
      exSets.sort(compareSets);
      return h('section', { class: 'card' },
        h('h2', {}, ex?.name ?? '（削除された種目）', ' ', ex ? h('span', { class: 'badge' }, PART_LABEL[ex.part] ?? '') : null,
          ex?.assist ? [' ', h('span', { class: 'badge badge-assist' }, '補助の重さ')] : null),
        h('div', { class: 'set-list' }, exSets.map((s, i) => button(
          [h('span', { class: 'set-no' }, `${i + 1}`), fmtSet(s)],
          async () => { if (await editSet(s, ex, i)) rerender(); },
          'set-chip',
          { 'aria-label': `${i + 1}セット目 ${fmtNum(s.weight)}キロ ${s.reps}回。押すと修正` },
        ))),
      );
    }),
    button('この日の記録を削除', async () => {
      const ok = await confirmDialog(`${formatDate(session.date, true)} の記録（${sets.length}セット）を削除します。元に戻せません。`, {
        ok: '削除する', danger: true,
      });
      if (!ok) return;
      await removeSession(session.id);
      toast('削除しました');
      location.hash = '#history';
    }, 'btn-danger-outline btn-block delete-session'),
  );
}
