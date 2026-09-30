// 書き出し・バックアップ・復元。画面から独立した純粋な関数だけを置く。

import { PARTS, PART_LABEL, REP_RANGE, WEEKLY_SET_GUIDE } from '../defaults.js';
import { SCHEMA_VERSION, STORES, migrate, findInvalid } from './migrate.js';
import { exerciseHistory, bestSet, stagnation, compareSessions, compareSets } from './progression.js';
import { weeklySetsByPart } from './stats.js';
import { fmtNum, fmtSet, weekdayOf, toDateStr, daysBetween } from '../util.js';

export const APP_ID = 'workout-log';

// ───────── 分析用の文章 ─────────

const exLabel = (ex) => (ex.assist ? `${ex.name}（補助）` : ex.name);

/** Claude などに貼って分析してもらいやすい Markdown 形式の文章 */
export function analysisText(data, today) {
  const exercises = [...data.exercises].sort((a, b) => a.order - b.order);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const sessions = [...data.sessions].sort(compareSessions);
  const setsBySession = new Map();
  for (const s of data.sets) {
    if (!setsBySession.has(s.sessionId)) setsBySession.set(s.sessionId, []);
    setsBySession.get(s.sessionId).push(s);
  }
  const trained = sessions.filter((s) => setsBySession.has(s.id));
  const lines = [];

  lines.push(`# 筋トレ記録（書き出し日：${today}）`, '');
  lines.push('- 単位：重さは kg、回数は回。セットは「重さ×回数」で表記');
  lines.push(`- 進め方：${REP_RANGE.min}〜${REP_RANGE.max}回で3セットが基本。全セット${REP_RANGE.max}回できたら次回は重さを一段階上げて${REP_RANGE.min}回から`);
  if (exercises.some((e) => e.assist)) {
    lines.push('- 「（補助）」が付いた種目は補助の重さを記録しているため、重さが小さいほど良い記録。全セット' + REP_RANGE.max + '回できたら補助を一段階減らす');
  }
  if (trained.length) {
    lines.push(`- 期間：${trained[0].date} 〜 ${trained.at(-1).date}（トレーニング ${trained.length}回）`);
  }
  lines.push('');

  // 種目ごとの要約
  lines.push('## 種目ごとの要約', '');
  lines.push('| 種目 | 部位 | 記録した回数 | 初回の一番良いセット | 最新の一番良いセット | 自己ベスト | 状態 |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const ex of exercises) {
    const hist = exerciseHistory(data, ex.id);
    if (hist.length === 0) continue;
    const st = stagnation(hist, ex.assist);
    const first = bestSet(hist[0].sets, ex.assist);
    const latest = bestSet(hist.at(-1).sets, ex.assist);
    const state = st.stalled ? `停滞中（${st.streak}回更新なし）` : st.streak === 0 ? '更新中' : `${st.streak}回更新なし`;
    lines.push(`| ${exLabel(ex)} | ${PART_LABEL[ex.part] ?? ex.part} | ${hist.length} | ${fmtSet(first)} | ${fmtSet(latest)} | ${fmtSet(st.best)} | ${state} |`);
  }
  lines.push('');

  // 部位ごとの週あたりセット数
  const weeks = weeklySetsByPart(data, today, 8);
  lines.push(`## 部位ごとの週あたりセット数（直近8週・月曜始まり・目安は週${WEEKLY_SET_GUIDE}セット）`, '');
  lines.push(`| 週の始まり | ${PARTS.map((p) => p.label).join(' | ')} |`);
  lines.push(`|---|${PARTS.map(() => '---').join('|')}|`);
  for (const w of weeks) lines.push(`| ${w.weekStart} | ${PARTS.map((p) => w.counts[p.id]).join(' | ')} |`);
  lines.push('');

  // 日付ごとの記録
  lines.push('## トレーニング記録', '');
  if (trained.length === 0) lines.push('（記録なし）', '');
  for (const session of trained) {
    lines.push(`### ${session.date}（${weekdayOf(session.date)}）`);
    const byEx = new Map();
    for (const s of [...setsBySession.get(session.id)].sort((a, b) => a.createdAt - b.createdAt)) {
      if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
      byEx.get(s.exerciseId).push(s);
    }
    for (const [exId, sets] of byEx) {
      lines.push(`- ${exById.has(exId) ? exLabel(exById.get(exId)) : '（削除された種目）'}：${sets.sort(compareSets).map(fmtSet).join(', ')}`);
    }
    lines.push('');
  }

  // 体重・お腹周り
  const body = [...data.body].sort((a, b) => (a.date < b.date ? -1 : 1));
  lines.push('## 体重・お腹周りの推移', '');
  if (body.length === 0) {
    lines.push('（記録なし）');
  } else {
    lines.push('| 日付 | 体重(kg) | お腹周り(cm) |', '|---|---|---|');
    for (const b of body) {
      lines.push(`| ${b.date} | ${b.weightKg != null ? fmtNum(b.weightKg) : '-'} | ${b.waistCm != null ? fmtNum(b.waistCm) : '-'} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// ───────── バックアップ ─────────

/**
 * バックアップの状況。記録があるのに一度もしていないか、warnDays 日以上たっていれば warn。
 * lastBackupAt はミリ秒の時刻（なければ null）。日数は端末の現地時刻の日付で数える。
 */
export function backupStatus(lastBackupAt, hasRecords, today, warnDays) {
  if (!lastBackupAt) return { lastDate: null, days: null, warn: hasRecords };
  const lastDate = toDateStr(new Date(lastBackupAt));
  const days = daysBetween(lastDate, today);
  return { lastDate, days, warn: hasRecords && days >= warnDays };
}

export function buildBackup(data, appVersion, now = new Date()) {
  return {
    app: APP_ID,
    appVersion,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.getTime(), // ミリ秒の時刻。表示するときに端末の現地時刻へ直す
    data: Object.fromEntries(STORES.map((s) => [s, data[s]])),
  };
}

export function backupFileName(today) {
  return `workout-log-backup-${today}.json`;
}

/**
 * バックアップのファイルの中身を読み、最新の版に移行して中身を確かめる。
 * 問題があれば分かりやすい文で Error を投げる。
 */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('JSON として読めないファイルです');
  }
  if (!obj || obj.app !== APP_ID || typeof obj.data !== 'object') {
    throw new Error('このアプリのバックアップではありません');
  }
  const data = migrate(obj.data, obj.schemaVersion);
  const problem = findInvalid(data);
  if (problem) throw new Error(`バックアップの中身に問題があります：${problem}`);
  return { data, exportedAt: obj.exportedAt ?? null };
}

export function countData(data) {
  return {
    sessions: data.sessions.length,
    sets: data.sets.length,
    body: data.body.length,
    exercises: data.exercises.length,
  };
}

/**
 * 今のデータとバックアップを統合する。同じ記録（同じ id）は今のデータを優先する。
 * - 種目：id が同じなら同じ種目。id が違っても名前が同じなら同じ種目として扱い、セットの参照を付け替える
 * - 体重・お腹周り：同じ日付の記録が既にあれば今のデータを優先する
 * 戻り値: { data, added: { exercises, sessions, sets, body } }
 */
export function mergeData(current, incoming) {
  const exIds = new Set(current.exercises.map((e) => e.id));
  const exByName = new Map(current.exercises.map((e) => [e.name, e.id]));
  let nextOrder = current.exercises.reduce((m, e) => Math.max(m, e.order), -1) + 1;
  const exMap = new Map();
  const newExercises = [];
  for (const e of [...incoming.exercises].sort((a, b) => a.order - b.order)) {
    if (exIds.has(e.id)) exMap.set(e.id, e.id);
    else if (exByName.has(e.name)) exMap.set(e.id, exByName.get(e.name));
    else {
      newExercises.push({ ...e, order: nextOrder++ });
      exMap.set(e.id, e.id);
    }
  }

  const sessionIds = new Set(current.sessions.map((s) => s.id));
  const newSessions = incoming.sessions.filter((s) => !sessionIds.has(s.id));

  const setIds = new Set(current.sets.map((s) => s.id));
  const newSets = incoming.sets
    .filter((s) => !setIds.has(s.id))
    .map((s) => ({ ...s, exerciseId: exMap.get(s.exerciseId) ?? s.exerciseId }));

  const bodyIds = new Set(current.body.map((b) => b.id));
  const bodyDates = new Set(current.body.map((b) => b.date));
  const newBody = incoming.body.filter((b) => !bodyIds.has(b.id) && !bodyDates.has(b.date));

  return {
    data: {
      exercises: [...current.exercises, ...newExercises],
      sessions: [...current.sessions, ...newSessions],
      sets: [...current.sets, ...newSets],
      body: [...current.body, ...newBody],
    },
    added: {
      exercises: newExercises.length,
      sessions: newSessions.length,
      sets: newSets.length,
      body: newBody.length,
    },
  };
}
