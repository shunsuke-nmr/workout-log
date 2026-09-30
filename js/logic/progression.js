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

// assist が true の種目（アシスト懸垂など）は「補助の重さ」を記録するので、重さが小さいほど良い。
// 以下の関数はすべて最後の引数 assist でその向きを切り替える（省略時は通常の種目）。

/**
 * a が b より良い記録なら true。
 * 通常：重さが上か、同じ重さで回数が上。補助：重さが下か、同じ重さで回数が上
 */
export function isBetter(a, b, assist = false) {
  if (!b) return !!a;
  if (!a) return false;
  if (a.weight !== b.weight) return assist ? a.weight < b.weight : a.weight > b.weight;
  return a.reps > b.reps;
}

/** セットの中の一番良い記録（通常は最大重量、補助は最小の補助。同じ重さなら最多回数）。セットがなければ null */
export function bestSet(sets, assist = false) {
  let best = null;
  for (const s of sets) {
    if (isBetter(s, best, assist)) best = { weight: s.weight, reps: s.reps };
  }
  return best;
}

/**
 * 今日の目標。
 * - 前回の全セットが上限回数（12回）以上 → 重さを1段階進めて回数は下限（8回）
 *   通常：前回の最大重量＋刻み。補助：前回の最小の補助−刻み（0kg 未満にはしない）
 * - そうでなければ各セット、前回と同じ重さで1回多く（上限まで）
 * - 補助がすでに 0kg（補助なし）で全セット上限なら、重さはそのままで回数を1回ずつ増やす
 * 戻り値: { kind: 'up' | 'reps', sets: [{ weight, reps }] }。前回がなければ null
 */
export function suggestTarget(prevSets, step, assist = false) {
  if (!prevSets || prevSets.length === 0) return null;
  const weights = prevSets.map((s) => s.weight);
  if (prevSets.every((s) => s.reps >= REP_RANGE.max)) {
    if (!assist) {
      const weight = round2(Math.max(...weights) + step);
      return { kind: 'up', sets: prevSets.map(() => ({ weight, reps: REP_RANGE.min })) };
    }
    const lightest = Math.min(...weights);
    if (lightest > 0) {
      const weight = round2(Math.max(0, lightest - step));
      return { kind: 'up', sets: prevSets.map(() => ({ weight, reps: REP_RANGE.min })) };
    }
    return { kind: 'reps', sets: prevSets.map((s) => ({ weight: s.weight, reps: s.reps + 1 })) };
  }
  return {
    kind: 'reps',
    sets: prevSets.map((s) => ({
      weight: s.weight,
      reps: s.reps >= REP_RANGE.max ? s.reps : s.reps + 1,
    })),
  };
}

/** 目標のセットを達成したか（補助は目標以下の補助でできていれば達成） */
export function meetsTarget(done, target, assist = false) {
  if (!done || !target) return false;
  const weightOk = assist ? done.weight <= target.weight : done.weight >= target.weight;
  return weightOk && done.reps >= target.reps;
}

/**
 * 停滞の判定。セッションごとの一番良い記録が、それまでの最高を上回らない回が
 * STALL_SESSIONS 回以上続いていれば停滞。
 * 戻り値: { stalled, streak（更新なしが続いている回数）, best（これまでの最高） }
 */
export const STALL_SESSIONS = 3;

export function stagnation(history, assist = false) {
  let best = null;
  let streak = 0;
  for (const entry of history) {
    const top = bestSet(entry.sets, assist);
    if (!top) continue;
    if (isBetter(top, best, assist)) {
      best = top;
      streak = 0;
    } else {
      streak++;
    }
  }
  return { stalled: streak >= STALL_SESSIONS, streak, best };
}
