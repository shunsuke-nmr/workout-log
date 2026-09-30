// 分析画面：停滞中の種目、部位ごとの週あたりセット数、種目ごとのグラフ。

import { loadAll } from '../db.js';
import { h, clear, button } from '../ui/dom.js';
import { lineChart, barChart } from '../ui/chart.js';
import { exerciseHistory, stagnation, STALL_SESSIONS } from '../logic/progression.js';
import { exerciseSeries, weeklySetsByPart } from '../logic/stats.js';
import { exKind, fmtBestKind } from '../logic/kinds.js';
import { PARTS, PART_LABEL, WEEKLY_SET_GUIDE } from '../defaults.js';
import { addDays, fmtNum, todayStr } from '../util.js';

export const title = '分析';

const WEEKS = 12;
let weekIndex = 0; // 0 = 今週、1 = 先週 …
let selectedEx = null;
let selectedPart = null;

// 目盛り（axis=true）では単位を省いて幅を節約する
const kg = (v, axis) => (axis ? fmtNum(v) : `${fmtNum(v)}kg`);
const kgComma = (v, axis) => `${Math.round(v).toLocaleString('ja-JP')}${axis ? '' : 'kg'}`;
const times = (v, axis) => (axis ? String(v) : `${v}回`);

export async function render(root) {
  const data = await loadAll();
  const rerender = () => render(root);
  const exercises = [...data.exercises].sort((a, b) => a.order - b.order);
  const withHistory = exercises
    .map((ex) => ({ ex, kind: exKind(ex), history: exerciseHistory(data, ex.id) }))
    .filter((x) => x.history.length > 0);

  clear(root).append(
    stalledSection(withHistory),
    weeklySection(data, rerender),
    exerciseSection(withHistory, rerender),
  );
}

function stalledSection(withHistory) {
  const stalled = withHistory
    .map((x) => ({ ...x, st: stagnation(x.history, x.kind) }))
    .filter((x) => x.st.stalled);
  return h('section', {},
    h('h2', { class: 'section-title' }, '停滞中の種目'),
    stalled.length === 0
      ? h('p', { class: 'card muted small' }, `${STALL_SESSIONS}回続けて記録が伸びていない種目はありません`)
      : h('ul', { class: 'list card stalled' }, stalled.map(({ ex, kind, st }) => h('li', { class: 'list-item' },
        h('span', { class: 'badge badge-warn' }, '⚠ 停滞中'),
        h('div', { class: 'list-main' },
          h('div', { class: 'name' }, ex.name),
          h('div', { class: 'sub' }, `最高 ${fmtBestKind(kind, st.best)}から${st.streak}回更新なし`),
        ),
      ))),
  );
}

function weeklySection(data, rerender) {
  const weeks = weeklySetsByPart(data, todayStr(), WEEKS);
  const w = weeks[weekIndex];
  const md = (d) => d.slice(5).split('-').map(Number).join('/');
  const range = `${md(w.weekStart)}〜${md(addDays(w.weekStart, 6))}`;
  const label = weekIndex === 0 ? `今週（${range}）` : weekIndex === 1 ? `先週（${range}）` : range;
  return h('section', {},
    h('h2', { class: 'section-title' }, '部位ごとの週あたりセット数'),
    h('div', { class: 'card' },
      h('div', { class: 'week-nav' },
        button('‹', () => { weekIndex++; rerender(); }, 'icon-btn', { 'aria-label': '前の週', disabled: weekIndex >= WEEKS - 1 }),
        h('span', { class: 'week-label' }, label),
        button('›', () => { weekIndex--; rerender(); }, 'icon-btn', { 'aria-label': '次の週', disabled: weekIndex === 0 }),
      ),
      barChart({
        rows: PARTS.map((p) => ({ label: p.label, value: w.counts[p.id] })),
        guide: WEEKLY_SET_GUIDE,
        guideLabel: `目安${WEEKLY_SET_GUIDE}`,
        label: `${label}の部位ごとのセット数`,
      }),
      h('p', { class: 'muted small' }, `縦線は目安の週${WEEKLY_SET_GUIDE}セット。月曜から日曜で数えます`),
    ),
  );
}

function exerciseSection(withHistory, rerender) {
  if (withHistory.length === 0) {
    return h('section', {},
      h('h2', { class: 'section-title' }, '種目ごとの推移'),
      h('p', { class: 'card muted small' }, '記録するとグラフが表示されます'));
  }
  if (!withHistory.some((x) => x.ex.id === selectedEx)) selectedEx = withHistory[0].ex.id;
  const current = withHistory.find((x) => x.ex.id === selectedEx);
  // 記録のある部位だけを出し、選んだ部位の種目だけを並べる
  const order = (id) => {
    const i = PARTS.findIndex((p) => p.id === id);
    return i < 0 ? PARTS.length : i;
  };
  const partIds = [...new Set(withHistory.map((x) => x.ex.part))].sort((a, b) => order(a) - order(b));
  if (!partIds.includes(selectedPart)) selectedPart = current.ex.part;
  const inPart = withHistory.filter((x) => x.ex.part === selectedPart);

  return h('section', {},
    h('h2', { class: 'section-title' }, '種目ごとの推移'),
    h('div', { class: 'part-tabs analysis-parts', role: 'group', 'aria-label': '部位' },
      partIds.map((id) => h('button', {
        type: 'button',
        class: 'part-tab',
        'aria-pressed': String(id === selectedPart),
        onclick: () => {
          selectedPart = id;
          selectedEx = withHistory.find((x) => x.ex.part === id).ex.id;
          rerender();
        },
      }, PART_LABEL[id] ?? id))),
    h('div', { class: 'ex-grid analysis-ex', role: 'group', 'aria-label': '種目' },
      inPart.map((x) => h('button', {
        type: 'button',
        class: 'ex-btn',
        'aria-pressed': String(x.ex.id === current.ex.id),
        onclick: () => { selectedEx = x.ex.id; rerender(); },
      }, h('span', { class: 'ex-name' }, x.ex.name)))),
    chartsFor(current),
  );
}

/**
 * 種目の種類ごとのグラフ（1つのグラフに1つの量だけ）。
 * - 通常：最大重量と総負荷量（重さ×回数の合計）
 * - 補助：補助の重さ（軽いほど良い）と回数の合計。重さ×回数は負荷の大きさを表さないため使わない
 * - 自重：1セットの最多回数と回数の合計
 */
function chartsFor({ ex, kind, history }) {
  const series = exerciseSeries(history, kind);
  const card = (heading, points, format, label) => h('div', { class: 'card' },
    h('h3', { class: 'chart-title' }, heading),
    lineChart({ points, format, label }));
  const pts = (key) => series.map((p) => ({ date: p.date, value: p[key] }));

  if (kind === 'assist') {
    return [
      card('補助の重さ（軽いほど良い）', pts('bestWeight'),
        (v, axis) => (axis ? fmtNum(v) : `補助 ${fmtNum(v)}kg`), `${ex.name}の補助の重さの推移。値が下がるほど良い`),
      card('回数の合計', pts('totalReps'), times, `${ex.name}の回数の合計の推移`),
    ];
  }
  if (kind === 'bodyweight') {
    return [
      card('1セットの最多回数', pts('maxReps'), times, `${ex.name}の1セットの最多回数の推移`),
      card('回数の合計', pts('totalReps'), times, `${ex.name}の回数の合計の推移`),
    ];
  }
  return [
    card('最大重量', pts('bestWeight'), kg, `${ex.name}の最大重量の推移`),
    card('総負荷量（重さ×回数の合計）', pts('volume'), kgComma, `${ex.name}の総負荷量の推移`),
  ];
}
