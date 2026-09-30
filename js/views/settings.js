// 設定画面：書き出し・バックアップ、種目の管理、表示テーマ、全データ削除。

import { loadAll, put, putMany, getMeta, setMeta, replaceAll, defaultData } from '../db.js';
import { PARTS, PART_LABEL, WEIGHT_STEPS, DEFAULT_EXERCISES } from '../defaults.js';
import { KINDS, exKind } from '../logic/kinds.js';
import { h, clear, button, showDialog, confirmDialog, alertDialog, segmented, toast } from '../ui/dom.js';
import { copyText, saveFile } from '../ui/share.js';
import { applyTheme } from '../theme.js';
import { appState } from '../state.js';
import { APP_VERSION } from '../version.js';
import { refreshBackupDot, backupWarningText } from '../backup-status.js';
import {
  analysisText, buildBackup, backupFileName, parseBackup, mergeData, countData, missingDefaults,
} from '../logic/exporter.js';
import { fmtNum, formatDate, toDateStr, todayStr, uid } from '../util.js';

export const title = '設定';

export async function render(root) {
  const data = await loadAll();
  const theme = await getMeta('theme', 'auto');
  const backup = await refreshBackupDot(data);
  const rerender = () => render(root);

  clear(root).append(
    exportSection(data, backup, rerender),
    exerciseSection(data.exercises, rerender),
    themeSection(theme),
    dangerSection(rerender),
    aboutSection(),
  );
}

// ───────── 書き出し・バックアップ ─────────

function exportSection(data, backup, rerender) {
  const counts = countData(data);

  const copy = async () => {
    const ok = await copyText(analysisText(data, todayStr()));
    if (ok) toast('コピーしました。Claude などに貼り付けて使えます');
    else alertDialog('コピーできませんでした。');
  };

  // 共有シートは「ボタンを押した直後」でないと開けないので、ここで待たずにファイルを作る
  const save = async () => {
    const json = JSON.stringify(buildBackup(data, APP_VERSION), null, 1);
    const result = await saveFile(json, backupFileName(todayStr()), 'application/json');
    if (result === 'cancelled') return;
    await setMeta('lastBackupAt', Date.now());
    toast(result === 'shared' ? 'バックアップを保存しました' : 'バックアップをダウンロードしました');
    rerender();
  };

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    tabindex: '-1',
    'aria-hidden': 'true',
    onchange: async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (file) await restore(file, rerender);
    },
  });

  return h('section', {},
    h('h2', { class: 'section-title' }, '書き出しとバックアップ'),
    backup.warn
      ? h('div', { class: 'notice notice-warn notice-inline', role: 'note' },
        backupWarningText(backup), '記録が消えたときのために「バックアップを保存」してください。')
      : null,
    h('div', { class: 'card stack' },
      h('p', { class: 'muted small' },
        `記録：トレーニング${counts.sessions}回・${counts.sets}セット・体重など${counts.body}件`, h('br'),
        `最後のバックアップ：${backup.lastDate ? `${formatDate(backup.lastDate, true)}（${backup.days}日前）` : 'まだありません'}`),
      button('分析用にコピー', copy, 'btn-block'),
      h('p', { class: 'muted small' }, '全記録を文章にしてコピーします。Claude に貼って分析してもらうときに使います。'),
      button('バックアップを保存', save, 'btn-primary btn-block'),
      h('p', { class: 'muted small' }, 'iPhone では共有画面が開くので「“ファイル”に保存」を選んでください。'),
      button('バックアップから復元', () => fileInput.click(), 'btn-block'),
      fileInput,
    ),
  );
}

async function restore(file, rerender) {
  let parsed;
  try {
    parsed = parseBackup(await file.text());
  } catch (err) {
    await alertDialog(err.message, '復元できません');
    return;
  }
  const c = countData(parsed.data);
  const when = parsed.exportedAt ? `${formatDate(toDateStr(new Date(parsed.exportedAt)), true)} に保存した` : '';
  const mode = await showDialog({
    title: 'バックアップから復元',
    body: h('div', {},
      h('p', {}, `${when}バックアップ：トレーニング${c.sessions}回・${c.sets}セット・体重など${c.body}件`),
      h('p', { class: 'muted small' }, '統合：今の記録を残したまま、バックアップにしかない記録を足します。\n上書き：今の記録をすべて消して、バックアップの内容に置き換えます。'),
    ),
    actions: [
      { label: '上書きする', value: 'replace', kind: 'danger-outline' },
      { label: 'キャンセル', value: null },
      { label: '統合する', value: 'merge', kind: 'primary' },
    ],
  });
  if (!mode) return;

  if (mode === 'replace') {
    const ok = await confirmDialog('今の記録はすべて消えて、バックアップの内容に置き換わります。元に戻せません。', {
      title: '上書きして復元', ok: '上書きする', danger: true,
    });
    if (!ok) return;
    await replaceAll(parsed.data);
    toast('バックアップの内容に置き換えました');
  } else {
    const current = await loadAll();
    const { data, added } = mergeData(current, parsed.data);
    const ok = await confirmDialog(
      `トレーニング${added.sessions}回・${added.sets}セット・体重など${added.body}件・種目${added.exercises}個を追加します。`,
      { title: '統合して復元', ok: '統合する' },
    );
    if (!ok) return;
    await replaceAll(data);
    toast('統合しました');
  }
  rerender();
}

// ───────── 全データ削除（二段階の確認） ─────────

function dangerSection(rerender) {
  const wipe = async () => {
    const first = await confirmDialog('記録・体重・種目の設定をすべて削除します。先にバックアップを保存しておくことをおすすめします。', {
      title: '全データを削除', ok: '次へ', danger: true,
    });
    if (!first) return;
    const second = await confirmDialog('本当に削除しますか？ この操作は元に戻せません。', {
      title: '最終確認', ok: '完全に削除する', danger: true,
    });
    if (!second) return;
    await replaceAll(defaultData());
    await setMeta('lastBackupAt', null);
    await setMeta('activeSessionId', null);
    toast('すべてのデータを削除しました');
    rerender();
  };
  return h('section', {},
    h('h2', { class: 'section-title' }, '全データの削除'),
    h('div', { class: 'card' }, button('全データを削除', wipe, 'btn-danger-outline btn-block')),
  );
}

function aboutSection() {
  const persisted = appState.persisted === true
    ? '保護されています（ブラウザが容量不足でも自動では消されません）'
    : appState.persisted === false
      ? '保護されていません（ホーム画面から開くと保護されやすくなります）'
      : '確認できません';
  return h('section', {},
    h('h2', { class: 'section-title' }, 'このアプリについて'),
    h('div', { class: 'card small' },
      h('p', {}, `バージョン ${APP_VERSION}`),
      h('p', {}, `保存領域：${persisted}`),
      h('p', { class: 'muted' }, '記録はこの端末のブラウザの中にだけ保存され、外部には送信されません。書き出しやバックアップをしたときだけ端末の外に出ます。'),
    ),
  );
}

function sortedExercises(exercises) {
  return [...exercises].sort((a, b) => a.order - b.order);
}

const openParts = new Set(); // 設定画面で開いている部位

/** 種目の一覧。部位ごとにまとめ、部位の中で並べ替えられる */
function exerciseSection(exercises, rerender) {
  const list = sortedExercises(exercises);
  const partIds = [...PARTS.map((p) => p.id), ...new Set(list.map((e) => e.part).filter((id) => !PART_LABEL[id]))];

  // 同じ部位の中で隣の種目と入れ替える
  const move = async (ex, dir) => {
    const group = list.filter((e) => e.part === ex.part);
    const other = group[group.indexOf(ex) + dir];
    if (!other) return;
    // 全体の並び順を振り直してから入れ替える（order の重複や欠番があっても崩れないように）
    const reordered = list.map((e, i) => ({ ...e, order: i }));
    const x = reordered.find((e) => e.id === ex.id);
    const y = reordered.find((e) => e.id === other.id);
    [x.order, y.order] = [y.order, x.order];
    await putMany('exercises', reordered);
    rerender();
    toast(`「${ex.name}」を${dir < 0 ? '上' : '下'}へ移動しました`);
  };

  const toggleHidden = async (ex) => {
    await put('exercises', { ...ex, hidden: !ex.hidden });
    toast(ex.hidden ? `「${ex.name}」を記録画面に表示します` : `「${ex.name}」を非表示にしました`);
    rerender();
  };

  const item = (e, i, group) => {
    const kind = exKind(e);
    const sub = [
      `${fmtNum(e.step)}kg刻み`,
      kind === 'assist' ? '補助' : kind === 'bodyweight' ? '自重' : null,
      e.note || null,
    ].filter(Boolean).join('・');
    return h('li', { class: `ex-item${e.hidden ? ' is-hidden' : ''}` },
      h('div', { class: 'name' }, e.name),
      h('div', { class: 'ex-item-row' },
        h('span', { class: 'sub' }, sub),
        h('div', { class: 'ex-item-actions' },
        button('↑', () => move(e, -1), 'icon-btn', { 'aria-label': `${e.name}を上へ`, disabled: i === 0 }),
        button('↓', () => move(e, 1), 'icon-btn', { 'aria-label': `${e.name}を下へ`, disabled: i === group.length - 1 }),
        h('button', {
          type: 'button',
          class: `btn toggle-btn${e.hidden ? '' : ' is-on'}`,
          'aria-pressed': String(!e.hidden),
          'aria-label': `${e.name}を記録画面に表示`,
          onclick: () => toggleHidden(e),
        }, e.hidden ? '非表示' : '表示中'),
        button('編集', async () => {
          if (await editExercise(e, exercises)) rerender();
        }),
        ),
      ),
    );
  };

  const groups = partIds
    .map((id) => ({ id, items: list.filter((e) => e.part === id) }))
    .filter((g) => g.items.length > 0);

  return h('section', {},
    h('h2', { class: 'section-title' }, '種目'),
    h('p', { class: 'muted small' }, '「表示中」の種目だけが記録画面に出ます。押すと切り替わります。'),
    // 部位ごとに開け閉めできる（開いている部位は画面を描き直しても開いたまま）
    groups.map((g) => h('details', {
      class: 'card ex-group',
      open: openParts.has(g.id),
      ontoggle: (ev) => { if (ev.target.open) openParts.add(g.id); else openParts.delete(g.id); },
    },
    h('summary', { class: 'ex-group-title' }, PART_LABEL[g.id] ?? g.id,
      h('span', { class: 'muted small' }, `表示中 ${g.items.filter((e) => !e.hidden).length} / ${g.items.length}`)),
    h('ul', { class: 'list' }, g.items.map((e, i) => item(e, i, g.items))))),
    h('div', { class: 'card stack' },
      button('＋ 種目を追加', async () => {
        if (await editExercise(null, exercises)) rerender();
      }, 'btn-block'),
      button('足りない初期種目を追加', () => addMissing(exercises, rerender), 'btn-block'),
      h('p', { class: 'muted small' }, '初期種目のうち、この端末にまだないものだけを足します（非表示のものは非表示のまま）。今の種目と記録は変わりません。'),
    ),
  );
}

async function addMissing(exercises, rerender) {
  const missing = missingDefaults(exercises, DEFAULT_EXERCISES);
  if (missing.length === 0) {
    await alertDialog('初期種目はすべてそろっています。');
    return;
  }
  const ok = await confirmDialog(`${missing.length}種目を追加します。\n${missing.map((e) => e.name).join('、')}`, {
    title: '足りない初期種目を追加', ok: '追加する',
  });
  if (!ok) return;
  await putMany('exercises', missing);
  toast(`${missing.length}種目を追加しました`);
  rerender();
}

/** 種目の追加・編集。保存したら true */
async function editExercise(ex, allExercises) {
  const isNew = !ex;
  const nameInput = h('input', {
    class: 'text-input',
    type: 'text',
    value: ex?.name ?? '',
    maxlength: '30',
    autocomplete: 'off',
    enterkeyhint: 'done',
  });
  const noteInput = h('input', {
    class: 'text-input',
    type: 'text',
    value: ex?.note ?? '',
    maxlength: '20',
    autocomplete: 'off',
    placeholder: '例：ダンベル、プレート式',
  });
  const part = segmented(PARTS.map((p) => ({ value: p.id, label: p.label })), ex?.part ?? 'back');
  const kind = segmented(KINDS.map((k) => ({ value: k.id, label: k.label })), exKind(ex));
  const step = segmented(WEIGHT_STEPS.map((s) => ({ value: s, label: fmtNum(s) })), ex?.step ?? 2.5);
  const hidden = h('input', { type: 'checkbox', checked: !!ex?.hidden });
  const errorEl = h('p', { class: 'error small', role: 'alert' });
  errorEl.hidden = true;

  const body = h('div', {},
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '名前'), nameInput),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '部位'), part.el),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '種類'), kind.el,
      h('p', { class: 'muted small kind-help' }, '通常：重さと回数／補助：補助の重さ（軽いほど良い）／自重：回数（重さは加重した分だけ）')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '重さの刻み（kg）'), step.el),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'メモ（器具など・任意）'), noteInput),
    isNew ? null : h('label', { class: 'check' }, hidden, '記録画面に表示しない'),
    errorEl,
  );

  const collect = () => {
    const name = nameInput.value.trim();
    const problem = !name
      ? '名前を入れてください'
      : allExercises.some((o) => o.id !== ex?.id && o.name === name)
        ? '同じ名前の種目があります'
        : null;
    if (problem) {
      errorEl.textContent = problem;
      errorEl.hidden = false;
      return undefined; // ダイアログを閉じない
    }
    // 1.0.1 までの assist の印は kind に置き換える
    const { assist: _oldAssist, ...base } = ex ?? {
      id: uid(),
      order: allExercises.reduce((m, o) => Math.max(m, o.order), -1) + 1,
      hidden: false,
    };
    return {
      ...base,
      name,
      part: part.get(),
      kind: kind.get(),
      step: Number(step.get()),
      note: noteInput.value.trim(),
      hidden: isNew ? false : hidden.checked,
    };
  };

  if (isNew) setTimeout(() => nameInput.focus(), 50);
  const result = await showDialog({
    title: isNew ? '種目を追加' : '種目を編集',
    body,
    actions: [
      { label: 'キャンセル', value: null },
      { label: '保存', value: collect, kind: 'primary' },
    ],
  });
  if (!result) return false;
  await put('exercises', result);
  toast(isNew ? `「${result.name}」を追加しました` : '保存しました');
  return true;
}
function themeSection(theme) {
  const seg = segmented(
    [
      { value: 'auto', label: '端末に合わせる' },
      { value: 'light', label: 'ライト' },
      { value: 'dark', label: 'ダーク' },
    ],
    theme,
    async (v) => {
      applyTheme(v);
      await setMeta('theme', v);
    },
  );
  return h('section', {},
    h('h2', { class: 'section-title' }, '表示'),
    h('div', { class: 'card' }, seg.el),
  );
}
