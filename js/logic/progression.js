// 前回の記録・自己ベスト・今日の目標・停滞の判定。画面や保存から独立した純粋な関数だけを置く。

import { REP_RANGE } from '../defaults.js';
import { round2 } from '../util.js';

/** セッションの並び順：日付、同じ日なら作った順 */
export function compareSessions(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

export function compareSets(a, b) {
  return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

/**
 * ある種目の記録を、セッションごとにまとめて古い順に返す。
 * 戻り値: [{ session, sets }]（sets はセット順）
 */
export function exerciseHistory(data, exerciseId) {
  const bySession = new Map();
  for (const s of data.sets) {
    if (s.exerciseId !== exerciseId) continue;
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId).push(s);
  }
  const sessions = new Map(data.sessions.map((s) => [s.id, s]));
  return [...bySession]
    .filter(([id]) => sessions.has(id))
    .map(([id, sets]) => ({ session: sessions.get(id), sets: sets.sort(compareSets) }))
    .sort((a, b) => compareSessions(a.session, b.session));
}

/** 今のセッションより前で、その種目を記録した直近のセッション（なければ null） */
export function previousEntry(history, currentSession) {
  const earlier = history.filter(
    (e) => e.session.id !== currentSession?.id
      && (!currentSession || compareSessions(e.session, currentSession) < 0),
  );
  return earlier.at(-1) ?? null;
}

// 種目の種類（kind）で「良い記録」の向きと目標の立て方が変わる（js/logic/kinds.js）。
//   weight     通常：重いほど良い
//   assist     補助：補助が軽いほど良い
//   bodyweight 自重：重さ（加重）が同じなら回数が多いほど良い。加重が重いほど良い
// 以下の関数はすべて最後の引数 kind で切り替える（省略時は通常）。

/** a が b より良い記録なら true。重さの向きは kind で決まり、同じ重さなら回数が多い方が良い */
export function isBetter(a, b, kind = 'weight') {
  if (!b) return !!a;
  if (!a) return false;
  if (a.weight !== b.weight) return kind === 'assist' ? a.weight < b.weight : a.weight > b.weight;
  return a.reps > b.reps;
}

/** セットの中の一番良い記録。セットがなければ null */
export function bestSet(sets, kind = 'weight') {
  let best = null;
  for (const s of sets) {
    if (isBetter(s, best, kind)) best = { weight: s.weight, reps: s.reps };
  }
  return best;
}

const repsUp = (prevSets, cap) => prevSets.map((s) => ({
  weight: s.weight,
  reps: cap && s.reps >= REP_RANGE.max ? s.reps : s.reps + 1,
}));
const allAtMax = (prevSets) => prevSets.every((s) => s.reps >= REP_RANGE.max);

/**
 * 今日の目標。戻り値: { kind: 'up' | 'reps', sets: [{ weight, reps }] }。前回がなければ null
 * - 通常：全セット12回以上 → 前回の最大重量＋刻み、8回。そうでなければ各セット前回＋1回（12回まで）
 * - 補助：全セット12回以上 → 前回の最小の補助−刻み（0kg 未満にしない）、8回。
 *         補助がすでに 0kg なら回数を1回ずつ増やす
 * - 自重：加重なしなら各セット前回＋1回（上限なし）。加重しているときは通常と同じ
 */
export function suggestTarget(prevSets, step, kind = 'weight') {
  if (!prevSets || prevSets.length === 0) return null;
  const weights = prevSets.map((s) => s.weight);

  if (kind === 'bodyweight' && Math.max(...weights) <= 0) {
    return { kind: 'reps', sets: repsUp(prevSets, false) };
  }
  if (kind === 'assist') {
    if (!allAtMax(prevSets)) return { kind: 'reps', sets: repsUp(prevSets, true) };
    const lightest = Math.min(...weights);
    if (lightest <= 0) return { kind: 'reps', sets: repsUp(prevSets, false) };
    const weight = round2(Math.max(0, lightest - step));
    return { kind: 'up', sets: prevSets.map(() => ({ weight, reps: REP_RANGE.min })) };
  }
  if (allAtMax(prevSets)) {
    const weight = round2(Math.max(...weights) + step);
    return { kind: 'up', sets: prevSets.map(() => ({ weight, reps: REP_RANGE.min })) };
  }
  return { kind: 'reps', sets: repsUp(prevSets, true) };
}

/** 目標のセットを達成したか（補助は目標以下の補助でできていれば達成） */
export function meetsTarget(done, target, kind = 'weight') {
  if (!done || !target) return false;
  const weightOk = kind === 'assist' ? done.weight <= target.weight : done.weight >= target.weight;
  return weightOk && done.reps >= target.reps;
}

/**
 * 停滞の判定。セッションごとの一番良い記録が、それまでの最高を上回らない回が
 * STALL_SESSIONS 回以上続いていれば停滞。
 * 戻り値: { stalled, streak（更新なしが続いている回数）, best（これまでの最高） }
 */
export const STALL_SESSIONS = 3;

export function stagnation(history, kind = 'weight') {
  let best = null;
  let streak = 0;
  for (const entry of history) {
    const top = bestSet(entry.sets, kind);
    if (!top) continue;
    if (isBetter(top, best, kind)) {
      best = top;
      streak = 0;
    } else {
      streak++;
    }
  }
  return { stalled: streak >= STALL_SESSIONS, streak, best };
}