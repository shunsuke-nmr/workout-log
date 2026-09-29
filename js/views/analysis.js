// 分析画面：停滞中の種目、部位ごとの週あたりセット数、種目ごとのグラフ。

import { loadAll } from '../db.js';
import { h, clear, button } from '../ui/dom.js';
import { lineChart, barChart } from '../ui/chart.js';
import { exerciseHistory, stagnation, STALL_SESSIONS } from '../logic/progression.js';
import { exerciseSeries, weeklySetsByPart } from '../logic/stats.js';
import { PARTS, WEEKLY_SET_GUIDE } from '../defaults.js';
import { addDays, fmtNum, todayStr } from '../util.js';

export const title = '分析';

const WEEKS = 12;
let weekIndex = 0; // 0 = 今週、1 = 先週 …
let selectedEx = null;

// 目盛り（axis=true）では単位を省いて幅を節約する
const kg = (v, axis) => (axis ? fmtNum(v) : `${fmtNum(v)}kg`);
const kgComma = (v, axis) => `${Math.round(v).toLocaleString('ja-JP')}${axis ? '' : 'kg'}`;

export async function render(root) {
  const data = await loadAll();
  const rerender = () => render(root);
  const exercises = [...data.exercises].sort((a, b) => a.order - b.order);
  const withHistory = exercises
    .map((ex) => ({ ex, history: exerciseHistory(data, ex.id) }))
    .filter((x) => x.history.length > 0);

  clear(root).append(
    stalledSection(withHistory),
    weeklySection(data, rerender),
    exerciseSection(withHistory, rerender),
  );
}

function stalledSection(withHistory) {
  const stalled = withHistory
    .map((x) => ({ ...x, st: stagnation(x.history) }))
    .filter((x) => x.st.stalled);
  return h('section', {},
    h('h2', { class: 'section-title' }, '停滞中の種目'),
    stalled.length === 0
      ? h('p', { class: 'card muted small' }, `${STALL_SESSIONS}回続けて記録が伸びていない種目はありません`)
      : h('ul', { class: 'list card stalled' }, stalled.map(({ ex, st }) => h('li', { class: 'list-item' },
        h('span', { class: 'badge badge-warn' }, '⚠ 停滞中'),
        h('div', { class: 'list-main' },
          h('div', { class: 'name' }, ex.name),
          h('div', { class: 'sub' }, `最高 ${fmtNum(st.best.weight)}kg × ${st.best.reps}回から${st.streak}回更新なし`),
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
  const { ex, history } = withHistory.find((x) => x.ex.id === selectedEx);
  const series = exerciseSeries(history);

  return h('section', {},
    h('h2', { class: 'section-title' }, '種目ごとの推移'),
    h('div', { class: 'chips chips-wrap', role: 'group', 'aria-label': '種目' },
      withHistory.map((x) => h('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(x.ex.id === ex.id),
        onclick: () => { selectedEx = x.ex.id; rerender(); },
      }, x.ex.name))),
    h('div', { class: 'card' },
      h('h3', { class: 'chart-title' }, '最大重量'),
      lineChart({
        points: series.map((p) => ({ date: p.date, value: p.maxWeight })),
        format: kg,
        label: `${ex.name}の最大重量の推移`,
      }),
    ),
    h('div', { class: 'card' },
      h('h3', { class: 'chart-title' }, '総負荷量（重さ×回数の合計）'),
      lineChart({
        points: series.map((p) => ({ date: p.date, value: p.volume })),
        format: kgComma,
        label: `${ex.name}の総負荷量の推移`,
      }),
    ),
  );
}
