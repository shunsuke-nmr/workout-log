// 種目の種類（通常・補助・自重）のテスト。数値はすべて架空。

import { test, eq } from './harness.js';
import { makeData } from './progression.test.js';
import { exKind, fmtSetKind, fmtBestKind } from '../js/logic/kinds.js';
import {
  isBetter, bestSet, suggestTarget, meetsTarget, stagnation, exerciseHistory,
} from '../js/logic/progression.js';
import { exerciseSeries } from '../js/logic/stats.js';
import { analysisText, missingDefaults, parseBackup, buildBackup } from '../js/logic/exporter.js';
import { findInvalid } from '../js/logic/migrate.js';
import { DEFAULT_EXERCISES } from '../js/defaults.js';

const sets = (...arr) => arr.map(([weight, reps]) => ({ weight, reps }));

// ── 種類の判定 ──
test('種類：kind があればそれを使う', () => {
  eq([exKind({ kind: 'bodyweight' }), exKind({ kind: 'assist' }), exKind({ kind: 'weight' })], ['bodyweight', 'assist', 'weight']);
});
test('種類：1.0.1 までのデータ（kind なし）は assist の印で判断し、なければ通常', () => {
  eq([exKind({ assist: true }), exKind({}), exKind(undefined)], ['assist', 'weight', 'weight']);
});
test('種類：不正な値のデータは読み込みで見つける', () => {
  const data = makeData([]);
  data.exercises[0].kind = 'other';
  eq(typeof findInvalid(data), 'string');
  delete data.exercises[0].kind;
  eq(findInvalid(data), null);
});

// ── 表示 ──
test('表示：自重は回数、加重があれば「+加重×回数」', () => {
  eq(fmtSetKind('bodyweight', { weight: 0, reps: 15 }), '15回');
  eq(fmtSetKind('bodyweight', { weight: 5, reps: 10 }), '+5×10');
  eq(fmtSetKind('weight', { weight: 42.5, reps: 8 }), '42.5×8');
});
test('表示：自己ベスト', () => {
  eq(fmtBestKind('assist', { weight: 20, reps: 8 }), '補助20kg × 8回');
  eq(fmtBestKind('bodyweight', { weight: 0, reps: 15 }), '15回');
  eq(fmtBestKind('bodyweight', { weight: 5, reps: 10 }), '加重+5kg × 10回');
  eq(fmtBestKind('weight', null), 'なし');
});

// ── 自重の記録 ──
test('自重：加重なしなら回数が多いほど良い', () => {
  eq(isBetter({ weight: 0, reps: 16 }, { weight: 0, reps: 15 }, 'bodyweight'), true);
  eq(bestSet(sets([0, 15], [0, 18], [0, 12]), 'bodyweight'), { weight: 0, reps: 18 });
});
test('自重：加重した記録は加重なしより良い', () => {
  eq(isBetter({ weight: 5, reps: 8 }, { weight: 0, reps: 20 }, 'bodyweight'), true);
});
test('自重：加重なしなら12回を超えても各セット1回ずつ増やす', () => {
  eq(suggestTarget(sets([0, 12], [0, 14], [0, 10]), 1, 'bodyweight'), {
    kind: 'reps', sets: sets([0, 13], [0, 15], [0, 11]),
  });
});
test('自重：加重しているときは通常と同じく12回で加重を増やす', () => {
  eq(suggestTarget(sets([5, 12], [5, 12]), 1, 'bodyweight'), {
    kind: 'up', sets: sets([6, 8], [6, 8]),
  });
});
test('自重：目標の達成判定', () => {
  eq(meetsTarget({ weight: 0, reps: 15 }, { weight: 0, reps: 15 }, 'bodyweight'), true);
  eq(meetsTarget({ weight: 0, reps: 14 }, { weight: 0, reps: 15 }, 'bodyweight'), false);
});
test('自重：回数が伸びていれば停滞ではない、3回伸びなければ停滞', () => {
  const up = makeData([['2026-09-01', [[0, 12]]], ['2026-09-04', [[0, 12]]], ['2026-09-08', [[0, 12]]], ['2026-09-11', [[0, 13]]]]);
  eq(stagnation(exerciseHistory(up, 'e1'), 'bodyweight').stalled, false);
  const flat = makeData([['2026-09-01', [[0, 15]]], ['2026-09-04', [[0, 14]]], ['2026-09-08', [[0, 15]]], ['2026-09-11', [[0, 13]]]]);
  eq(stagnation(exerciseHistory(flat, 'e1'), 'bodyweight').stalled, true);
});
test('自重の推移：1セットの最多回数と回数の合計', () => {
  const data = makeData([['2026-09-01', [[0, 15], [0, 12], [0, 10]]]]);
  const [p] = exerciseSeries(exerciseHistory(data, 'e1'), 'bodyweight');
  eq([p.maxReps, p.totalReps], [15, 37]);
});

// ── 書き出し・バックアップ ──
test('分析用の文章：自重の種目は（自重）を付けて回数で書く', () => {
  const data = makeData([['2026-09-28', [[0, 15], [0, 12]]]]);
  data.exercises[0].name = 'レッグレイズ';
  data.exercises[0].kind = 'bodyweight';
  const text = analysisText(data, '2026-09-30');
  eq(text.includes('- レッグレイズ（自重）：15回, 12回'), true);
  eq(text.includes('| レッグレイズ（自重） | 背中 | 1 | 15回 | 15回 | 15回 | 更新中 |'), true);
});
test('バックアップ：種目の種類とメモも保存・復元される', () => {
  const data = makeData([['2026-09-28', [[0, 15]]]]);
  Object.assign(data.exercises[0], { kind: 'bodyweight', note: 'ベンチ' });
  const back = parseBackup(JSON.stringify(buildBackup(data, '1.0.2')));
  eq([back.data.exercises[0].kind, back.data.exercises[0].note], ['bodyweight', 'ベンチ']);
});

// ── 足りない初期種目の追加 ──
test('足りない初期種目：id か名前が同じ種目は足さず、今の種目の後ろに並べる', () => {
  const current = [
    { id: 'ex-lat-pulldown', name: 'ラットプルダウン', order: 0 },
    { id: 'my-1', name: 'シーテッドロウ', order: 5 }, // 名前が同じ
  ];
  const added = missingDefaults(current, DEFAULT_EXERCISES);
  eq(added.length, DEFAULT_EXERCISES.length - 2);
  eq(added.some((e) => e.name === 'ラットプルダウン' || e.name === 'シーテッドロウ'), false);
  eq(added[0].order, 6);
});
test('足りない初期種目：そろっていれば何も足さない', () => {
  eq(missingDefaults(DEFAULT_EXERCISES, DEFAULT_EXERCISES), []);
});
test('足りない初期種目：非表示の初期種目は非表示のまま足す', () => {
  const added = missingDefaults([], DEFAULT_EXERCISES);
  eq(added.find((e) => e.name === 'ベンチプレス').hidden, true);
});
