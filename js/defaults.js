// 部位と初期種目の定義。
// 初期種目の id は固定にしておく（別の端末のバックアップと統合したときに同じ種目として扱えるように）。

export const PARTS = [
  { id: 'back', label: '背中' },
  { id: 'chest', label: '胸' },
  { id: 'shoulder', label: '肩' },
  { id: 'leg', label: '脚' },
  { id: 'arm', label: '腕' },
  { id: 'core', label: '体幹' },
];

export const PART_LABEL = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));

export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];

/**
 * 初期種目。刻みは初期値で、設定画面で変えられる。
 * assist: true は「補助の重さ」を入れる種目（アシスト懸垂など）。重さが小さいほど良い記録として扱う。
 * 以前の版と同じ種目は同じ id のままにしている（古いバックアップと統合しても重複しないように）。
 */
export const DEFAULT_EXERCISES = [
  // 背中
  { id: 'ex-lat-pulldown', name: 'ラットプルダウン', part: 'back', step: 2.5 },
  { id: 'ex-seated-row', name: 'シーテッドロウ', part: 'back', step: 2.5 },
  { id: 'ex-dy-row', name: 'DYロウ', part: 'back', step: 2.5 },
  { id: 'ex-assisted-pullup', name: 'アシスト懸垂', part: 'back', step: 2.5, assist: true },
  // 胸
  { id: 'ex-chest-press', name: 'チェストプレス', part: 'chest', step: 2.5 },
  { id: 'ex-decline-press', name: 'デクラインプレス', part: 'chest', step: 2.5 },
  { id: 'ex-pec-fly', name: 'ペクトラルフライ', part: 'chest', step: 2.5 },
  // 肩
  { id: 'ex-shoulder-press', name: 'ショルダープレス', part: 'shoulder', step: 2.5 },
  { id: 'ex-rear-delt', name: 'リアデルトイド', part: 'shoulder', step: 2.5 },
  { id: 'ex-side-raise', name: 'サイドレイズ', part: 'shoulder', step: 1 },
  // 脚
  { id: 'ex-seated-leg-press', name: 'シーテッドレッグプレス', part: 'leg', step: 2.5 },
  { id: 'ex-leg-curl', name: 'レッグカール', part: 'leg', step: 2.5 },
  { id: 'ex-leg-extension', name: 'レッグエクステンション', part: 'leg', step: 2.5 },
  // 腕
  { id: 'ex-arm-curl', name: 'アームカール', part: 'arm', step: 1 },
  { id: 'ex-triceps-pushdown', name: 'トライセプスプレスダウン', part: 'arm', step: 2.5 },
  // 体幹
  { id: 'ex-ab-crunch', name: 'アブドミナルクランチ', part: 'core', step: 2.5 },
].map((e, i) => ({ assist: false, ...e, order: i, hidden: false }));

/** 目標提案で使う回数の範囲 */
export const REP_RANGE = { min: 8, max: 12 };

/** 部位ごとの週あたりセット数の目安 */
export const WEEKLY_SET_GUIDE = 10;

/** この日数を超えてバックアップしていなければ知らせる */
export const BACKUP_WARN_DAYS = 30;
