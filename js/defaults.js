// 部位と初期種目の定義。
// 初期種目の id は固定にしておく（別の端末のバックアップと統合したときに同じ種目として扱えるように）。

export const PARTS = [
  { id: 'back', label: '背中' },
  { id: 'chest', label: '胸' },
  { id: 'shoulder', label: '肩' },
  { id: 'leg', label: '脚' },
  { id: 'arm', label: '腕' },
];

export const PART_LABEL = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));

export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];

export const DEFAULT_EXERCISES = [
  { id: 'ex-lat-pulldown', name: 'ラットプルダウン', part: 'back', step: 2.5 },
  { id: 'ex-seated-row', name: 'シーテッドロー', part: 'back', step: 2.5 },
  { id: 'ex-chest-press', name: 'チェストプレス', part: 'chest', step: 2.5 },
  { id: 'ex-side-raise', name: 'サイドレイズ', part: 'shoulder', step: 1 },
  { id: 'ex-leg-press', name: 'レッグプレス', part: 'leg', step: 5 },
  { id: 'ex-arm-curl', name: 'アームカール', part: 'arm', step: 1 },
  { id: 'ex-triceps-pushdown', name: 'トライセプスプレスダウン', part: 'arm', step: 2.5 },
].map((e, i) => ({ ...e, order: i, hidden: false }));

/** 目標提案で使う回数の範囲 */
export const REP_RANGE = { min: 8, max: 12 };

/** 部位ごとの週あたりセット数の目安 */
export const WEEKLY_SET_GUIDE = 10;

/** この日数を超えてバックアップしていなければ知らせる */
export const BACKUP_WARN_DAYS = 30;
