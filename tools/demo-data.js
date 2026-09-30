// 開発・スクリーンショット用の架空データ。実在の人物の記録ではない。
// パソコンで簡易サーバーを動かし http://localhost:8000/?demo を開いたときだけ読み込まれる（公開先では動かない）。

import { DEFAULT_EXERCISES, REP_RANGE } from '../js/defaults.js';
import { addDays, todayStr, mondayOf, parseDate, round2 } from '../js/util.js';

// 同じ結果になる疑似乱数（毎回同じスクリーンショットになるように）
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 開始時の重さ（架空）。アシスト懸垂は補助の重さ
const START = {
  'ex-lat-pulldown': 35,
  'ex-seated-row': 35,
  'ex-dy-row': 30,
  'ex-assisted-pullup': 35,
  'ex-chest-press': 30,
  'ex-decline-press': 30,
  'ex-pec-fly': 25,
  'ex-shoulder-press': 20,
  'ex-rear-delt': 20,
  'ex-side-raise': 5,
  'ex-seated-leg-press': 60,
  'ex-leg-curl': 25,
  'ex-leg-extension': 30,
  'ex-arm-curl': 8,
  'ex-triceps-pushdown': 20,
  'ex-ab-crunch': 20,
};
// この種目は最後の数回わざと伸び悩ませる（停滞表示の確認用）
const STALL_ID = 'ex-side-raise';
// 1回6種目。3日で全種目を回る
const DAYS = [
  ['ex-lat-pulldown', 'ex-assisted-pullup', 'ex-chest-press', 'ex-shoulder-press', 'ex-seated-leg-press', 'ex-ab-crunch'],
  ['ex-seated-row', 'ex-decline-press', 'ex-side-raise', 'ex-leg-curl', 'ex-arm-curl', 'ex-triceps-pushdown'],
  ['ex-dy-row', 'ex-assisted-pullup', 'ex-pec-fly', 'ex-rear-delt', 'ex-leg-extension', 'ex-side-raise'],
];

export function buildDemoData(weeks = 10) {
  const rand = rng(20260401);
  const exercises = DEFAULT_EXERCISES.map((e) => ({ ...e }));
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const state = Object.fromEntries(exercises.map((e) => [e.id, { weight: START[e.id], reps: [10, 9, 8] }]));
  const sessions = [];
  const sets = [];
  const body = [];

  const today = todayStr();
  const firstMonday = addDays(mondayOf(today), -7 * weeks);
  const days = [];
  for (let d = firstMonday; d < today; d = addDays(d, 1)) {
    const dow = (parseDate(d).getDay() + 6) % 7; // 月=0
    if (dow === 0 || dow === 2 || dow === 4) days.push(d);
  }

  days.forEach((date, i) => {
    const session = { id: `demo-s${i}`, date, createdAt: parseDate(date).getTime() + (7 * 60 + 10) * 60000 };
    sessions.push(session);
    const stallPhase = i >= days.length - 9;
    let minute = 0;
    DAYS[i % DAYS.length].forEach((exId) => {
      const ex = exById.get(exId);
      const st = state[exId];
      st.reps.forEach((reps, j) => {
        sets.push({
          id: `demo-${i}-${exId}-${j}`,
          sessionId: session.id,
          exerciseId: exId,
          weight: st.weight,
          reps,
          order: j,
          createdAt: session.createdAt + (minute += 2) * 60000,
        });
      });
      if (exId === STALL_ID && stallPhase) return; // 伸びない
      if (st.reps.every((r) => r >= REP_RANGE.max)) {
        // 全セット上限なら重さを進める（補助の種目は補助を減らす）
        st.weight = round2(ex.assist ? Math.max(0, st.weight - ex.step) : st.weight + ex.step);
        st.reps = [REP_RANGE.min + 1, REP_RANGE.min, REP_RANGE.min - 1];
      } else {
        st.reps = st.reps.map((r) => Math.min(REP_RANGE.max, r + (rand() < 0.75 ? 1 : 0)));
      }
    });
  });

  // 体重とお腹周り（架空の値）。週1回、ときどき片方だけ
  let w = 70.0;
  let waist = 84.0;
  for (let k = weeks; k >= 0; k--) {
    const date = addDays(mondayOf(today), -7 * k + 1);
    if (date > today) continue;
    w = round2(w - 0.15 + (rand() - 0.5) * 0.5);
    waist = round2(waist - 0.2 + (rand() - 0.5) * 0.4);
    body.push({
      id: `demo-b${k}`,
      date,
      weightKg: Math.round(w * 10) / 10,
      waistCm: k % 3 === 1 ? null : Math.round(waist * 10) / 10,
    });
  }

  return { exercises, sessions, sets, body };
}
