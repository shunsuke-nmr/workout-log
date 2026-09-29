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

/** 重さが上か、同じ重さで回数が上なら true */
export function isBetter(a, b) {
  if (!b) return !!a;
  if (!a) return false;
  return a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps);
}

/** セットの中の一番良い記録（最大重量、同じ重さなら最多回数）。セットがなければ null */
export function bestSet(sets) {
  let best = null;
  for (const s of sets) {
    if (isBetter(s, best)) best = { weight: s.weight, reps: s.reps };
  }
  return best;
}

/**
 * 今日の目標。
 * - 前回の全セットが上限回数（12回）以上 → 前回の最大重量＋刻み1段階、回数は下限（8回）
 * - そうでなければ各セット、前回と同じ重さで1回多く（上限まで）
 * 戻り値: { kind: 'up' | 'reps', sets: [{ weight, reps }] }。前回がなければ null
 */
export function suggestTarget(prevSets, step) {
  if (!prevSets || prevSets.length === 0) return null;
  if (prevSets.every((s) => s.reps >= REP_RANGE.max)) {
    const weight = round2(Math.max(...prevSets.map((s) => s.weight)) + step);
    return { kind: 'up', sets: prevSets.map(() => ({ weight, reps: REP_RANGE.min })) };
  }
  return {
    kind: 'reps',
    sets: prevSets.map((s) => ({
      weight: s.weight,
      reps: s.reps >= REP_RANGE.max ? s.reps : s.reps + 1,
    })),
  };
}

/** 目標のセットを達成したか */
export function meetsTarget(done, target) {
  return !!done && !!target && done.weight >= target.weight && done.reps >= target.reps;
}

/**
 * 停滞の判定。セッションごとの一番良い記録が、それまでの最高を上回らない回が
 * STALL_SESSIONS 回以上続いていれば停滞。
 * 戻り値: { stalled, streak（更新なしが続いている回数）, best（これまでの最高） }
 */
export const STALL_SESSIONS = 3;

export function stagnation(history) {
  let best = null;
  let streak = 0;
  for (const entry of history) {
    const top = bestSet(entry.sets);
    if (!top) continue;
    if (isBetter(top, best)) {
      best = top;
      streak = 0;
    } else {
      streak++;
    }
  }
  return { stalled: streak >= STALL_SESSIONS, streak, best };
}
