// 補助の重さを入れる種目（アシスト懸垂など）のテスト。補助は軽いほど良い。数値はすべて架空。

import { test, eq } from './harness.js';
import { makeData } from './progression.test.js';
import {
  isBetter, bestSet, suggestTarget, meetsTarget, stagnation, exerciseHistory,
} from '../js/logic/progression.js';

const sets = (...arr) => arr.map(([weight, reps]) => ({ weight, reps }));

test('補助：軽い補助の方が良い記録', () => {
  eq(isBetter({ weight: 20, reps: 8 }, { weight: 25, reps: 12 }, 'assist'), true);
  eq(isBetter({ weight: 25, reps: 12 }, { weight: 20, reps: 8 }, 'assist'), false);
});
test('補助：同じ補助なら回数が多い方が良い記録', () => {
  eq(isBetter({ weight: 20, reps: 9 }, { weight: 20, reps: 8 }, 'assist'), true);
});
test('通常の種目は今までどおり重い方が良い記録', () => {
  eq(isBetter({ weight: 25, reps: 8 }, { weight: 20, reps: 12 }), true);
});

test('補助：自己ベストは最小の補助、同じ補助なら最多回数', () => {
  eq(bestSet(sets([30, 12], [25, 8], [25, 10], [27.5, 12]), 'assist'), { weight: 25, reps: 10 });
});

test('補助：全セット12回できたら補助を一段階減らして8回', () => {
  eq(suggestTarget(sets([25, 12], [25, 12], [27.5, 12]), 2.5, 'assist'), {
    kind: 'up', sets: sets([22.5, 8], [22.5, 8], [22.5, 8]),
  });
});
test('補助：12回未満のセットがあれば同じ補助で1回多く', () => {
  eq(suggestTarget(sets([25, 12], [25, 10]), 2.5, 'assist'), {
    kind: 'reps', sets: sets([25, 12], [25, 11]),
  });
});
test('補助：減らしても0kg未満にはしない', () => {
  eq(suggestTarget(sets([1, 12], [1, 12]), 2.5, 'assist').sets, sets([0, 8], [0, 8]));
});
test('補助：すでに補助なし（0kg）で全セット12回なら回数を増やす', () => {
  eq(suggestTarget(sets([0, 12], [0, 12]), 2.5, 'assist'), {
    kind: 'reps', sets: sets([0, 13], [0, 13]),
  });
});

test('補助：目標以下の補助でできていれば達成', () => {
  eq(meetsTarget({ weight: 20, reps: 8 }, { weight: 22.5, reps: 8 }, 'assist'), true);
  eq(meetsTarget({ weight: 25, reps: 8 }, { weight: 22.5, reps: 8 }, 'assist'), false);
});

test('補助：補助が減っていれば停滞ではない', () => {
  const data = makeData([
    ['2026-09-01', [[30, 10]]],
    ['2026-09-04', [[30, 10]]],
    ['2026-09-08', [[30, 10]]],
    ['2026-09-11', [[27.5, 8]]],
  ]);
  eq(stagnation(exerciseHistory(data, 'e1'), 'assist').stalled, false);
});
test('補助：補助が増えただけなら記録は伸びていない', () => {
  const data = makeData([
    ['2026-09-01', [[25, 10]]],
    ['2026-09-04', [[27.5, 12]]],
    ['2026-09-08', [[30, 12]]],
    ['2026-09-11', [[25, 10]]],
  ]);
  const r = stagnation(exerciseHistory(data, 'e1'), 'assist');
  eq([r.stalled, r.streak, r.best], [true, 3, { weight: 25, reps: 10 }]);
});
