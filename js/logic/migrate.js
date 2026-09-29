// データ構造のバージョン管理と移行。
// 構造を変えるときは SCHEMA_VERSION を上げ、MIGRATIONS に「ひとつ前の版 → その版」への変換を足す。
// 起動時（端末内のデータ）と復元時（古いバックアップ）の両方でこの関数を通す。

export const SCHEMA_VERSION = 1;

export const STORES = ['exercises', 'sessions', 'sets', 'body'];

/**
 * MIGRATIONS[n] は版 n-1 のデータを受け取り、版 n のデータを返す。
 * 例）版2で sets にメモ欄を足すなら:
 *   2: (data) => ({ ...data, sets: data.sets.map((s) => ({ ...s, note: '' })) }),
 */
const MIGRATIONS = {};

export function emptyData() {
  return Object.fromEntries(STORES.map((s) => [s, []]));
}

export function migrate(data, fromVersion) {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new Error(`データの版が不正です（${fromVersion}）`);
  }
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(`このデータはアプリより新しい版（${fromVersion}）で作られています。アプリを更新してください`);
  }
  let out = { ...emptyData(), ...data };
  for (let v = fromVersion + 1; v <= SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`版${v}への移行処理がありません`);
    out = step(out);
  }
  return out;
}

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 最新版のデータとして中身が正しいか確かめる。問題があれば最初の1件を説明する文字列を返す */
export function findInvalid(data) {
  for (const s of STORES) {
    if (!Array.isArray(data[s])) return `${s} が配列ではありません`;
  }
  for (const e of data.exercises) {
    if (!isStr(e.id) || !isStr(e.name) || !isStr(e.part) || !isNum(e.step) || !isNum(e.order)) {
      return `種目のデータが不正です（${e.name ?? e.id}）`;
    }
  }
  for (const s of data.sessions) {
    if (!isStr(s.id) || !isDate(s.date)) return `トレーニング日のデータが不正です（${s.date ?? s.id}）`;
  }
  const exIds = new Set(data.exercises.map((e) => e.id));
  const sessionIds = new Set(data.sessions.map((s) => s.id));
  for (const t of data.sets) {
    if (!isStr(t.id) || !isNum(t.weight) || !isNum(t.reps)) return 'セットのデータが不正です';
    if (!sessionIds.has(t.sessionId) || !exIds.has(t.exerciseId)) return 'セットの参照先が見つかりません';
  }
  for (const b of data.body) {
    if (!isStr(b.id) || !isDate(b.date)) return '体重・お腹周りのデータが不正です';
    if (b.weightKg != null && !isNum(b.weightKg)) return '体重の値が不正です';
    if (b.waistCm != null && !isNum(b.waistCm)) return 'お腹周りの値が不正です';
  }
  return null;
}
