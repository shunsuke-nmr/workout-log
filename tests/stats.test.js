// 集計のテスト。数値はすべて架空。

import { test, eq } from './harness.js';
import { makeData } from './progression.test.js';
import { exerciseHistory } from '../js/logic/progression.js';
import { exerciseSeries, weeklySetsByPart, bodySeries } from '../js/logic/stats.js';
import { parseMeasure } from '../js/views/body.js';
import { niceTicks } from '../js/ui/chart.js';

test('種目の推移：最大重量と総負荷量', () => {
  const data = makeData([['2026-09-01', [[40, 10], [40, 8], [37.5, 10]]]]);
  eq(exerciseSeries(exerciseHistory(data, 'e1')), [
    { date: '2026-09-01', bestWeight: 40, volume: 1095, maxReps: 10, totalReps: 28, sets: 3 },
  ]);
});

test('補助の種目の推移：一番良い重さは最小の補助、回数の合計も出す', () => {
  const data = makeData([['2026-09-01', [[25, 8], [22.5, 6], [25, 7]]], ['2026-09-04', [[20, 8], [20, 7]]]]);
  const series = exerciseSeries(exerciseHistory(data, 'e1'), 'assist');
  eq(series.map((p) => [p.bestWeight, p.totalReps]), [[22.5, 21], [20, 15]]);
});

test('週あたりセット数：月曜始まりで数える', () => {
  const data = makeData([
    ['2026-09-27', [[40, 10], [40, 10]]], // 日曜 → 前の週
    ['2026-09-28', [[40, 10], [40, 10], [40, 10]]], // 月曜 → 今週
    ['2026-09-30', [[40, 10]]], // 水曜 → 今週
  ]);
  const weeks = weeklySetsByPart(data, '2026-10-04', 3); // 今日は日曜
  eq(weeks.map((w) => [w.weekStart, w.counts.back]), [
    ['2026-09-28', 4],
    ['2026-09-21', 2],
    ['2026-09-14', 0],
  ]);
});

test('週あたりセット数：部位ごとに分ける', () => {
  const data = makeData([['2026-09-28', [[40, 10]]]]);
  data.exercises.push({ id: 'e2', name: '種目B', part: 'leg', step: 5, order: 1, hidden: false });
  data.sets.push({ id: 'x', sessionId: 's0', exerciseId: 'e2', weight: 80, reps: 10, order: 0, createdAt: 0 });
  const [w] = weeklySetsByPart(data, '2026-09-30', 1);
  eq([w.counts.back, w.counts.leg, w.counts.chest], [1, 1, 0]);
});

test('体重の推移は値のある日だけ日付順', () => {
  const body = [
    { id: 'a', date: '2026-09-10', weightKg: 60.2, waistCm: null },
    { id: 'b', date: '2026-09-03', weightKg: 60.5, waistCm: 75 },
    { id: 'c', date: '2026-09-17', weightKg: null, waistCm: 74.5 },
  ];
  eq(bodySeries(body, 'weightKg'), [{ date: '2026-09-03', value: 60.5 }, { date: '2026-09-10', value: 60.2 }]);
  eq(bodySeries(body, 'waistCm').map((p) => p.value), [75, 74.5]);
});

test('体重・お腹周りの入力の読み取り', () => {
  const range = [20, 300];
  eq(parseMeasure('', range), null);
  eq(parseMeasure(' 60.25 ', range), 60.3);
  eq(parseMeasure('６０．５', range), 60.5); // 全角
  eq(parseMeasure('60,5', range), 60.5);
  eq(Number.isNaN(parseMeasure('abc', range)), true);
  eq(Number.isNaN(parseMeasure('5', range)), true); // 範囲外
});

test('グラフの目盛りはきりのいい数', () => {
  eq(niceTicks(37.5, 45), [36, 38, 40, 42, 44, 46]);
  eq(niceTicks(40, 40).length > 1, true);
});
