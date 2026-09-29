// グラフや分析のための集計。画面から独立した純粋な関数だけを置く。

import { PARTS } from '../defaults.js';
import { addDays, mondayOf, round2 } from '../util.js';
import { bestSet } from './progression.js';

/** 種目の推移：セッションごとの最大重量と総負荷量（重さ×回数の合計） */
export function exerciseSeries(history) {
  return history.map(({ session, sets }) => ({
    date: session.date,
    maxWeight: bestSet(sets)?.weight ?? 0,
    volume: round2(sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
    sets: sets.length,
  }));
}

/**
 * 部位ごとの週あたりセット数（月曜始まり・現地時刻）。
 * 戻り値: [{ weekStart, counts: { back: n, ... } }] を新しい週から weeks 週分
 */
export function weeklySetsByPart(data, today, weeks = 8) {
  const exPart = new Map(data.exercises.map((e) => [e.id, e.part]));
  const sessionDate = new Map(data.sessions.map((s) => [s.id, s.date]));
  const thisMonday = mondayOf(today);
  const result = [];
  const index = new Map();
  for (let i = 0; i < weeks; i++) {
    const weekStart = addDays(thisMonday, -7 * i);
    const row = { weekStart, counts: Object.fromEntries(PARTS.map((p) => [p.id, 0])) };
    result.push(row);
    index.set(weekStart, row);
  }
  for (const s of data.sets) {
    const date = sessionDate.get(s.sessionId);
    if (!date) continue;
    const row = index.get(mondayOf(date));
    const part = exPart.get(s.exerciseId);
    if (row && part in row.counts) row.counts[part]++;
  }
  return result;
}

/** 体重・お腹周りの推移（値のある日だけ、古い順） */
export function bodySeries(body, key) {
  return body
    .filter((b) => typeof b[key] === 'number')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((b) => ({ date: b.date, value: b[key] }));
}

/** 日付ごとの履歴一覧用：セッションごとのセット数・種目数・総負荷量 */
export function sessionSummaries(data) {
  const bySession = new Map();
  for (const s of data.sets) {
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId).push(s);
  }
  return data.sessions.map((session) => {
    const sets = bySession.get(session.id) ?? [];
    return {
      session,
      setCount: sets.length,
      exerciseIds: [...new Set(sets.map((s) => s.exerciseId))],
      volume: round2(sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
    };
  });
}
