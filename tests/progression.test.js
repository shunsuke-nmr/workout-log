// 目標提案・自己ベスト・前回・停滞・データの版のテスト。数値はすべて架空。

import { test, eq } from './harness.js';
import {
  exerciseHistory, previousEntry, bestSet, suggestTarget, stagnation, meetsTarget,
} from '../js/logic/progression.js';
import { migrate, findInvalid, SCHEMA_VERSION } from '../js/logic/migrate.js';

const sets = (...arr) => arr.map(([weight, reps]) => ({ weight, reps }));

/** entries: [[日付, [[重さ, 回数], ...]], ...] から、種目1つ分のデータを作る */
export function makeData(entries, exerciseId = 'e1') {
  const data = {
    exercises: [{ id: exerciseId, name: '種目A', part: 'back', step: 2.5, order: 0, hidden: false }],
    sessions: [],
    sets: [],
    body: [],
  };
  entries.forEach(([date, ss], i) => {
    data.sessions.push({ id: `s${i}`, date, createdAt: i });
    ss.forEach(([weight, reps], j) => data.sets.push({
      id: `s${i}-${j}`, sessionId: `s${i}`, exerciseId, weight, reps, order: j, createdAt: j,
    }));
  });
  return data;
}

// ── 目標提案 ──
test('全セット12回できたら重さを一段階上げて8回', () => {
  eq(suggestTarget(sets([40, 12], [40, 12], [40, 12]), 2.5), {
    kind: 'up', sets: sets([42.5, 8], [42.5, 8], [42.5, 8]),
  });
});
test('重さが違うセットがあっても最大重量＋刻み', () => {
  eq(suggestTarget(sets([40, 12], [37.5, 12]), 2.5).sets, sets([42.5, 8], [42.5, 8]));
});
test('12回未満のセットがあれば各セット前回＋1回（12回が上限）', () => {
  eq(suggestTarget(sets([40, 12], [40, 11], [40, 9]), 2.5), {
    kind: 'reps', sets: sets([40, 12], [40, 12], [40, 10]),
  });
});
test('前回がなければ提案しない', () => {
  eq(suggestTarget([], 2.5), null);
  eq(suggestTarget(undefined, 2.5), null);
});
test('目標の達成判定', () => {
  eq(meetsTarget({ weight: 40, reps: 12 }, { weight: 40, reps: 11 }), true);
  eq(meetsTarget({ weight: 37.5, reps: 15 }, { weight: 40, reps: 8 }), false);
  eq(meetsTarget(undefined, { weight: 40, reps: 8 }), false);
});

// ── 自己ベスト ──
test('自己ベストは最大重量、同じ重さなら回数', () => {
  eq(bestSet(sets([40, 12], [42.5, 6], [42.5, 8], [35, 15])), { weight: 42.5, reps: 8 });
  eq(bestSet([]), null);
});

// ── 前回 ──
test('前回は今のセッションより前の直近', () => {
  const data = makeData([['2026-09-20', [[40, 10]]], ['2026-09-25', [[40, 11]]], ['2026-09-30', [[40, 12]]]]);
  const hist = exerciseHistory(data, 'e1');
  eq(previousEntry(hist, data.sessions[2]).session.id, 's1');
  eq(previousEntry(hist, data.sessions[0]), null);
});
test('日付を後から前に直したセッションも日付順で扱う', () => {
  const data = makeData([['2026-09-25', [[40, 11]]], ['2026-09-20', [[40, 10]]]]);
  const hist = exerciseHistory(data, 'e1');
  eq(hist.map((e) => e.session.date), ['2026-09-20', '2026-09-25']);
  eq(previousEntry(hist, data.sessions[0]).session.id, 's1');
});

// ── 停滞 ──
test('3回続けて更新がなければ停滞', () => {
  const data = makeData([
    ['2026-09-01', [[40, 10]]],
    ['2026-09-04', [[40, 10]]],
    ['2026-09-08', [[40, 9]]],
    ['2026-09-11', [[37.5, 12]]],
  ]);
  const r = stagnation(exerciseHistory(data, 'e1'));
  eq([r.stalled, r.streak], [true, 3]);
});
test('同じ重さで回数が増えたら停滞ではない', () => {
  const data = makeData([
    ['2026-09-01', [[40, 10]]],
    ['2026-09-04', [[40, 10]]],
    ['2026-09-08', [[40, 10]]],
    ['2026-09-11', [[40, 11]]],
  ]);
  eq(stagnation(exerciseHistory(data, 'e1')).stalled, false);
});
test('更新なしが2回だけならまだ停滞ではない', () => {
  const data = makeData([['2026-09-01', [[40, 10]]], ['2026-09-04', [[40, 10]]], ['2026-09-08', [[40, 10]]]]);
  const r = stagnation(exerciseHistory(data, 'e1'));
  eq([r.stalled, r.streak], [false, 2]);
});

// ── データの版と中身のチェック ──
test('現在の版のデータはそのまま通る', () => {
  eq(findInvalid(migrate(makeData([['2026-09-01', [[40, 10]]]]), SCHEMA_VERSION)), null);
});
test('アプリより新しい版のデータは受け付けない', () => {
  let msg = '';
  try { migrate({}, SCHEMA_VERSION + 1); } catch (e) { msg = e.message; }
  eq(msg.includes('新しい版'), true);
});
test('参照先のないセットは不正として見つける', () => {
  const data = makeData([['2026-09-01', [[40, 10]]]]);
  data.exercises = [];
  eq(typeof findInvalid(data), 'string');
});
