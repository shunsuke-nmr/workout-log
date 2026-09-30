// 外部ライブラリを使わない SVG グラフ。
// CSP で style 属性を禁止しているので、色や線は CSS のクラス（chart-line など）で指定する。

import { h } from './dom.js';
import { daysBetween, formatDate, parseDate } from '../util.js';

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** 目盛りをきりのいい数にする */
export function niceTicks(min, max, count = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  // 0.25 のような読みにくい刻みを避けるため 1・2・5 の倍数だけにする
  const step = [1, 2, 5, 10].map((m) => m * mag).find((st) => st >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const shortDate = (d) => {
  const x = parseDate(d);
  return `${x.getMonth() + 1}/${x.getDate()}`;
};

/**
 * 折れ線グラフ（系列は1本だけ。2つの量は別々のグラフにする）。
 * points: [{ date: 'YYYY-MM-DD', value }]、format: 値→表示文字列
 * 押した（なぞった）点の値を上の欄に表示する。初めは最新の値。
 */
export function lineChart({ points, format, label }) {
  const W = 340;
  const H = 170;
  const M = { top: 12, right: 14, bottom: 24, left: 44 };
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;

  const readout = h('p', { class: 'chart-readout num', 'aria-live': 'polite' });
  const wrap = h('figure', { class: 'chart' }, readout);
  if (points.length === 0) {
    readout.textContent = 'まだ記録がありません';
    return wrap;
  }

  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, points.at(-1).date));
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks.at(-1);
  const x = (d) => (points.length === 1 ? M.left + pw / 2 : M.left + (daysBetween(first, d) / span) * pw);
  const y = (v) => M.top + ph - ((v - yMin) / (yMax - yMin)) * ph;

  const grid = ticks.map((t) => s('g', {},
    s('line', { class: 'chart-grid', x1: M.left, x2: W - M.right, y1: y(t), y2: y(t) }),
    s('text', { class: 'chart-axis', x: M.left - 6, y: y(t) + 4, 'text-anchor': 'end' }, format(t, true)),
  ));
  const xLabels = [points[0], points.length > 2 ? points[Math.floor((points.length - 1) / 2)] : null, points.at(-1)]
    .filter((p, i, arr) => p && arr.findIndex((q) => q?.date === p.date) === i)
    .map((p, i, arr) => s('text', {
      class: 'chart-axis',
      x: x(p.date),
      y: H - 6,
      'text-anchor': arr.length === 1 ? 'middle' : i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle',
    }, shortDate(p.date)));

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const line = s('path', { class: 'chart-line', d });
  const dots = points.map((p) => s('circle', { class: 'chart-dot', cx: x(p.date), cy: y(p.value), r: 4 }));
  const cross = s('line', { class: 'chart-cross', y1: M.top, y2: M.top + ph });
  const focus = s('circle', { class: 'chart-focus', r: 6 });

  const select = (i) => {
    const p = points[i];
    readout.textContent = `${formatDate(p.date, true)}　${format(p.value)}`;
    cross.setAttribute('x1', x(p.date));
    cross.setAttribute('x2', x(p.date));
    focus.setAttribute('cx', x(p.date));
    focus.setAttribute('cy', y(p.value));
  };

  // 当たり判定は線より広く、グラフ全体にする
  const hit = s('rect', { class: 'chart-hit', x: M.left - 10, y: 0, width: pw + 20, height: H });
  const svg = s('svg', {
    class: 'chart-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label,
  }, grid, xLabels, line, dots, cross, focus, hit);
  const pick = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    select(best);
  };
  hit.addEventListener('pointerdown', pick);
  hit.addEventListener('pointermove', (ev) => {
    if (ev.buttons || ev.pointerType === 'mouse') pick(ev);
  });
  select(points.length - 1);

  wrap.append(svg, dataTable(points, format));
  return wrap;
}

/** グラフの数値を表で見られるようにする（色や形が見分けにくい場合のため） */
function dataTable(points, format) {
  return h('details', { class: 'chart-table' },
    h('summary', {}, '数値の一覧'),
    h('table', {},
      h('tbody', {}, [...points].reverse().map((p) => h('tr', {},
        h('td', {}, formatDate(p.date, true)),
        h('td', { class: 'num' }, format(p.value)),
      ))),
    ),
  );
}

/**
 * 横棒グラフ（部位ごとの週あたりセット数など）。目安の値に縦線を引く。
 * rows: [{ label, value }]
 */
export function barChart({ rows, guide, guideLabel, label }) {
  const W = 340;
  const rowH = 30;
  const M = { top: 20, right: 28, bottom: 4, left: 44 };
  const H = M.top + rows.length * rowH + M.bottom;
  const pw = W - M.left - M.right;
  const max = Math.max(guide * 1.5, ...rows.map((r) => r.value));
  const x = (v) => M.left + (v / max) * pw;

  const bars = rows.map((r, i) => {
    const yTop = M.top + i * rowH + 5;
    const bh = rowH - 10;
    return s('g', {},
      s('text', { class: 'chart-label', x: M.left - 8, y: yTop + bh / 2 + 5, 'text-anchor': 'end' }, r.label),
      r.value > 0 ? s('rect', { class: 'chart-bar', x: M.left, y: yTop, width: Math.max(4, x(r.value) - M.left), height: bh, rx: 4 }) : null,
      s('text', { class: 'chart-value', x: (r.value > 0 ? x(r.value) : M.left) + 6, y: yTop + bh / 2 + 5 }, String(r.value)),
    );
  });
  const gx = x(guide);
  const guideLine = s('g', {},
    s('line', { class: 'chart-guide', x1: gx, x2: gx, y1: M.top - 4, y2: H - M.bottom }),
    s('text', { class: 'chart-axis', x: gx, y: M.top - 8, 'text-anchor': 'middle' }, guideLabel),
  );
  return s('svg', { class: 'chart-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label },
    s('line', { class: 'chart-baseline', x1: M.left, x2: M.left, y1: M.top, y2: H - M.bottom }),
    bars,
    guideLine,
  );
}
