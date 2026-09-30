// 記録画面。スクロールなしで1画面に収め、よく押すボタンは画面の下半分に置く。

import { loadAll, put, getMeta, setMeta } from '../db.js';
import { h, clear, button, stepper, toast } from '../ui/dom.js';
import { editSessionDate, editSet } from '../ui/editors.js';
import {
  exerciseHistory, previousEntry, bestSet, suggestTarget, meetsTarget, stagnation,
  isBetter, compareSets, compareSessions,
} from '../logic/progression.js';
import { todayStr, formatDate, fmtNum, uid, round2 } from '../util.js';
import { exKind, fmtSetKind, fmtBestKind, weightInputFor } from '../logic/kinds.js';
import { PARTS } from '../defaults.js';
import { getBackupStatus, backupWarningText } from '../backup-status.js';

export const title = '記録';

// 日付を過去に直したセッションでも、始めてからこの時間内なら続けて記録できる
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
// 初めての種目の入力の初期値（自重は加重なし）
const FIRST_INPUT = { weight: 20, reps: 10 };
const FIRST_INPUT_BODYWEIGHT = { weight: 0, reps: 10 };

let selectedId = null; // 選んでいる種目
let selectedPart = null; // 選んでいる部位
const lastInPart = new Map(); // 部位 → その部位で最後に選んだ種目
const inputs = new Map(); // `${セッションid}:${種目id}` → 入力中の { weight, reps }
let busy = false; // 二度押しで同じセットが2つ入らないように

async function findActiveSession(data) {
  const today = todayStr();
  const activeId = await getMeta('activeSessionId');
  const active = data.sessions.find((s) => s.id === activeId);
  if (active && (active.date === today || Date.now() - active.createdAt < ACTIVE_WINDOW_MS)) return active;
  return data.sessions.filter((s) => s.date === today).sort(compareSessions).at(-1) ?? null;
}

export async function render(root) {
  const data = await loadAll();
  const session = await findActiveSession(data);
  const rerender = () => render(root);
  const backup = session ? null : await getBackupStatus(data);
  clear(root).append(session ? recordScreen(data, session, rerender) : startScreen(data, backup, rerender));
}

function startScreen(data, backup, rerender) {
  const last = [...data.sessions].sort(compareSessions).at(-1);
  let summary = 'まだ記録がありません';
  if (last) {
    const exNames = new Map(data.exercises.map((e) => [e.id, e.name]));
    const names = [...new Set(data.sets.filter((s) => s.sessionId === last.id).map((s) => exNames.get(s.exerciseId)))];
    summary = `前回 ${formatDate(last.date)}：${names.join('、') || '記録なし'}`;
  }
  return h('div', { class: 'start' },
    h('p', { class: 'start-date' }, formatDate(todayStr(), true)),
    h('p', { class: 'muted' }, summary),
    backup.warn
      ? h('a', { class: 'notice notice-warn notice-inline notice-link', href: '#settings' }, backupWarningText(backup), ' 設定からバックアップを保存してください ›')
      : null,
    button('今日のトレーニング開始', async () => {
      const session = { id: uid(), date: todayStr(), createdAt: Date.now() };
      await put('sessions', session);
      await setMeta('activeSessionId', session.id);
      rerender();
    }, 'btn-primary btn-lg btn-block start-btn'),
  );
}

function recordScreen(data, session, rerender) {
  const exercises = data.exercises.filter((e) => !e.hidden).sort((a, b) => a.order - b.order);
  if (exercises.length === 0) {
    return h('p', { class: 'muted' }, '表示する種目がありません。設定で種目を表示に切り替えてください。');
  }

  const sessionSets = data.sets.filter((s) => s.sessionId === session.id);
  const countByEx = new Map();
  for (const s of sessionSets) countByEx.set(s.exerciseId, (countByEx.get(s.exerciseId) ?? 0) + 1);

  // 初めは、今日最後に記録した種目（再読み込みしても続きから）。なければまだ記録していない最初の種目
  if (!exercises.some((e) => e.id === selectedId)) {
    const lastSet = [...sessionSets].sort((a, b) => a.createdAt - b.createdAt).at(-1);
    selectedId = (exercises.find((e) => e.id === lastSet?.exerciseId)
      ?? exercises.find((e) => !countByEx.get(e.id))
      ?? exercises[0]).id;
  }
  const ex = exercises.find((e) => e.id === selectedId);

  // 部位で絞り込む（表示中の種目がある部位だけを出す）
  const parts = PARTS.filter((p) => exercises.some((e) => e.part === p.id));
  const extraParts = [...new Set(exercises.map((e) => e.part))].filter((id) => !parts.some((p) => p.id === id))
    .map((id) => ({ id, label: id })); // 定義にない部位（古いデータなど）も選べるように
  const allParts = [...parts, ...extraParts];
  if (!allParts.some((p) => p.id === selectedPart)) selectedPart = ex.part;
  lastInPart.set(ex.part, ex.id);
  const partExercises = exercises.filter((e) => e.part === selectedPart);

  const kind = exKind(ex);
  const fmt = (x) => fmtSetKind(kind, x);
  const history = exerciseHistory(data, ex.id);
  const past = history.filter((e) => e.session.id !== session.id);
  const todaySets = sessionSets.filter((s) => s.exerciseId === ex.id).sort(compareSets);
  const prev = previousEntry(history, session);
  const target = suggestTarget(prev?.sets, ex.step, kind);
  const pastBest = bestSet(past.flatMap((e) => e.sets), kind);
  const todayBest = bestSet(todaySets, kind);
  const stall = stagnation(past, kind);

  const key = `${session.id}:${ex.id}`;
  if (!inputs.has(key)) {
    const first = kind === 'bodyweight' ? FIRST_INPUT_BODYWEIGHT : FIRST_INPUT;
    const base = todaySets.at(-1) ?? target?.sets[0] ?? prev?.sets.at(-1) ?? first;
    inputs.set(key, { weight: base.weight, reps: base.reps });
  }
  const input = inputs.get(key);

  const addSet = async (values) => {
    if (busy) return;
    busy = true;
    try {
      const set = {
        id: uid(),
        sessionId: session.id,
        exerciseId: ex.id,
        weight: round2(values.weight),
        reps: values.reps,
        order: (todaySets.at(-1)?.order ?? -1) + 1,
        createdAt: Date.now(),
      };
      await put('sets', set);
      await setMeta('activeSessionId', session.id);
      const bestSoFar = isBetter(todayBest, pastBest, kind) ? todayBest : pastBest;
      toast(pastBest && isBetter(set, bestSoFar, kind) ? `自己ベスト更新！ ${fmt(set)}` : `記録しました ${fmt(set)}`);
      await rerender();
    } finally {
      busy = false;
    }
  };

  const selectExercise = (id) => {
    selectedId = id;
    rerender();
  };

  // ── 上部：日付 ──
  const kindBadge = kind === 'assist' ? '補助の重さ・軽いほど良い' : kind === 'bodyweight' ? '自重・回数を記録' : null;
  const head = h('div', { class: 'rec-head' },
    button(formatDate(session.date), async () => { if (await editSessionDate(session)) rerender(); }, 'btn-ghost rec-date', {
      'aria-label': `日付 ${formatDate(session.date)}。押すと変更`,
    }),
    kindBadge ? h('span', { class: 'badge badge-assist' }, kindBadge) : null,
    h('span', { class: 'muted small' }, `今日 ${sessionSets.length}セット`),
  );

  // ── 部位 → 種目 ──
  const partTabs = h('div', { class: 'part-tabs', role: 'group', 'aria-label': '部位' },
    allParts.map((p) => {
      const done = exercises.some((e) => e.part === p.id && countByEx.get(e.id));
      return h('button', {
        type: 'button',
        class: `part-tab${done ? ' has-sets' : ''}`,
        'aria-pressed': String(p.id === selectedPart),
        'aria-label': `${p.label}${done ? '（今日記録あり）' : ''}`,
        onclick: () => {
          selectedPart = p.id;
          // その部位で前に選んだ種目、なければまだ記録していない最初の種目
          const inPart = exercises.filter((e) => e.part === p.id);
          const next = inPart.find((e) => e.id === lastInPart.get(p.id))
            ?? inPart.find((e) => !countByEx.get(e.id))
            ?? inPart[0];
          selectExercise(next.id);
        },
      }, p.label);
    }),
  );
  const exGrid = h('div', { class: 'ex-grid', role: 'group', 'aria-label': '種目' },
    partExercises.map((e) => h('button', {
      type: 'button',
      class: 'ex-btn',
      'aria-pressed': String(e.id === ex.id),
      onclick: () => selectExercise(e.id),
    },
    h('span', { class: 'ex-name' }, e.name),
    countByEx.get(e.id) ? h('span', { class: 'chip-count', 'aria-label': `${countByEx.get(e.id)}セット済み` }, countByEx.get(e.id)) : null)),
  );

  // ── 中段：前回・目標・自己ベスト ──
  const info = h('dl', { class: 'info card' },
    h('dt', {}, prev ? `前回 ${formatDate(prev.session.date)}` : '前回'),
    h('dd', { class: 'num' }, prev ? prev.sets.map((s) => h('span', { class: 'tset' }, fmt(s))) : 'なし（初めての種目）'),
    h('dt', {}, '今日の目標'),
    h('dd', { class: 'num' },
      target
        ? [
          target.kind === 'up' ? h('span', { class: 'badge badge-good' }, kind === 'assist' ? '補助を減らす' : '重さアップ') : null,
          ' ',
          target.sets.map((t, i) => h('span', {
            class: `tset${meetsTarget(todaySets[i], t, kind) ? ' done' : ''}`,
          }, fmt(t))),
        ]
        : h('span', { class: 'muted' }, '記録すると次回から提案します')),
    h('dt', {}, '自己ベスト'),
    h('dd', { class: 'num' },
      fmtBestKind(kind, pastBest),
      todayBest && pastBest && isBetter(todayBest, pastBest, kind) ? [' ', h('span', { class: 'badge badge-good' }, `今日更新 ${fmt(todayBest)}`)] : null,
      stall.stalled ? [' ', h('span', { class: 'badge badge-warn' }, `停滞中（${stall.streak}回更新なし）`)] : null,
    ),
  );

  // ── 今日のセット（押すと修正・削除） ──
  const today = h('div', { class: 'today', 'aria-label': '今日のセット' },
    todaySets.length
      ? todaySets.map((s, i) => button([h('span', { class: 'set-no' }, `${i + 1}`), fmt(s)], async () => { if (await editSet(s, ex, i)) rerender(); }, 'set-chip', {
        'aria-label': `${i + 1}セット目 ${fmtBestKind(kind, s)}。押すと修正`,
      }))
      : h('p', { class: 'muted small today-empty' }, kind === 'bodyweight' ? '回数を合わせて「セット追加」' : '重さと回数を合わせて「セット追加」'),
  );

  // ── 下半分：入力とボタン ──
  const wi = weightInputFor(kind);
  const weight = stepper({
    value: input.weight, step: () => ex.step, min: 0, max: 500, label: wi.label,
    format: wi.format, onChange: (v) => { input.weight = v; },
  });
  const reps = stepper({
    value: input.reps, step: () => 1, min: 1, max: 100, label: '回数',
    format: (v) => `${v} 回`, onChange: (v) => { input.reps = v; },
  });
  const last = todaySets.at(-1);
  const controls = h('div', { class: 'controls' },
    weight.el,
    reps.el,
    h('div', { class: 'rec-actions' },
      button(last ? ['直前と同じ', h('span', { class: 'sub-label num' }, fmt(last))] : '直前と同じ', () => addSet(last), 'btn-lg repeat-btn', { disabled: !last }),
      button('セット追加', () => addSet(input), 'btn-primary btn-lg'),
    ),
  );

  return h('div', { class: `record kind-${kind}` }, head, partTabs, exGrid, info, today, controls);
}