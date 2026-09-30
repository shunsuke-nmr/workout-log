// 部位と初期種目の定義。
// 初期種目の id は固定にしておく（別の端末のバックアップと統合したときに同じ種目として扱えるように）。

export const PARTS = [
  { id: 'back', label: '背中' },
  { id: 'chest', label: '胸' },
  { id: 'shoulder', label: '肩' },
  { id: 'leg', label: '脚' },
  { id: 'glute', label: 'お尻' },
  { id: 'arm', label: '腕' },
  { id: 'core', label: '体幹' },
];

export const PART_LABEL = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));

export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];

/**
 * 初期種目。刻み（step）は初期値で、設定画面で変えられる。
 * kind：'weight' 通常 / 'assist' 補助（軽いほど良い） / 'bodyweight' 自重（回数。重さは加重分）
 * hidden：true は最初は記録画面に出さない（設定で表示に切り替えられる）
 * note：器具などの補足（設定画面に表示）
 * 以前の版と同じ種目は同じ id のままにしている（古いバックアップと統合しても重複しないように）。
 */
const LIST = [
  // 背中
  { id: 'ex-lat-pulldown', name: 'ラットプルダウン', part: 'back', step: 2.5 },
  { id: 'ex-seated-row', name: 'シーテッドロウ', part: 'back', step: 2.5 },
  { id: 'ex-dy-row', name: 'DYロウ', part: 'back', step: 2.5, note: 'プレート式' },
  { id: 'ex-assisted-pullup', name: 'アシスト懸垂', part: 'back', step: 2.5, kind: 'assist' },
  { id: 'ex-one-hand-row', name: 'ワンハンドロウ', part: 'back', step: 1, note: 'ダンベル', hidden: true },
  { id: 'ex-deadlift', name: 'デッドリフト', part: 'back', step: 2.5, note: 'バーベル', hidden: true },
  { id: 'ex-back-extension', name: '45度バックエクステンション', part: 'back', step: 1, kind: 'bodyweight', hidden: true },
  // 胸
  { id: 'ex-chest-press', name: 'チェストプレス', part: 'chest', step: 2.5 },
  { id: 'ex-decline-press', name: 'デクラインプレス', part: 'chest', step: 2.5, note: 'プレート式' },
  { id: 'ex-pec-fly', name: 'ペクトラルフライ', part: 'chest', step: 2.5 },
  { id: 'ex-bench-press', name: 'ベンチプレス', part: 'chest', step: 2.5, note: 'バーベル', hidden: true },
  { id: 'ex-smith-bench-press', name: 'スミスベンチプレス', part: 'chest', step: 2.5, hidden: true },
  { id: 'ex-dumbbell-press', name: 'ダンベルプレス', part: 'chest', step: 1, hidden: true },
  { id: 'ex-incline-dumbbell-press', name: 'インクラインダンベルプレス', part: 'chest', step: 1, hidden: true },
  { id: 'ex-dumbbell-fly', name: 'ダンベルフライ', part: 'chest', step: 1, hidden: true },
  { id: 'ex-cable-crossover', name: 'ケーブルクロスオーバー', part: 'chest', step: 2.5, hidden: true },
  // 肩
  { id: 'ex-shoulder-press', name: 'ショルダープレス', part: 'shoulder', step: 2.5 },
  { id: 'ex-rear-delt', name: 'リアデルトイド', part: 'shoulder', step: 2.5 },
  { id: 'ex-side-raise', name: 'サイドレイズ', part: 'shoulder', step: 1, note: 'ダンベル' },
  { id: 'ex-plate-shoulder-press', name: 'ショルダープレス（プレート式）', part: 'shoulder', step: 2.5, note: 'プレート式', hidden: true },
  { id: 'ex-dumbbell-shoulder-press', name: 'ダンベルショルダープレス', part: 'shoulder', step: 1, hidden: true },
  { id: 'ex-cable-side-raise', name: 'ケーブルサイドレイズ', part: 'shoulder', step: 2.5, hidden: true },
  { id: 'ex-face-pull', name: 'フェイスプル', part: 'shoulder', step: 2.5, note: 'ケーブル', hidden: true },
  // 脚
  { id: 'ex-seated-leg-press', name: 'シーテッドレッグプレス', part: 'leg', step: 2.5 },
  { id: 'ex-leg-curl', name: 'レッグカール', part: 'leg', step: 2.5 },
  { id: 'ex-leg-extension', name: 'レッグエクステンション', part: 'leg', step: 2.5 },
  { id: 'ex-linear-leg-press', name: 'リニアレッグプレス', part: 'leg', step: 2.5, note: 'プレート式', hidden: true },
  { id: 'ex-squat', name: 'スクワット', part: 'leg', step: 2.5, note: 'バーベル', hidden: true },
  { id: 'ex-smith-squat', name: 'スミススクワット', part: 'leg', step: 2.5, hidden: true },
  { id: 'ex-hip-adduction', name: 'ヒップアダクション', part: 'leg', step: 2.5, hidden: true },
  // お尻
  { id: 'ex-hip-abduction', name: 'ヒップアブダクション', part: 'glute', step: 2.5, hidden: true },
  { id: 'ex-booty-builder', name: 'ブーティービルダー', part: 'glute', step: 2.5, note: 'プレート式', hidden: true },
  // 腕
  { id: 'ex-arm-curl', name: 'アームカール', part: 'arm', step: 1, note: 'ダンベル' },
  { id: 'ex-triceps-pushdown', name: 'トライセプスプレスダウン', part: 'arm', step: 2.5, note: 'ケーブル' },
  { id: 'ex-preacher-curl', name: 'プリーチャーカール', part: 'arm', step: 1, note: 'アームカールベンチ', hidden: true },
  { id: 'ex-hammer-curl', name: 'ハンマーカール', part: 'arm', step: 1, note: 'ダンベル', hidden: true },
  { id: 'ex-cable-curl', name: 'ケーブルカール', part: 'arm', step: 2.5, hidden: true },
  { id: 'ex-assisted-dip', name: 'アシストディップス', part: 'arm', step: 2.5, kind: 'assist', hidden: true },
  // 体幹
  { id: 'ex-ab-crunch', name: 'アブドミナルクランチ', part: 'core', step: 2.5 },
  { id: 'ex-torso-rotation', name: 'トーソローテーション', part: 'core', step: 2.5, hidden: true },
  { id: 'ex-leg-raise', name: 'レッグレイズ', part: 'core', step: 1, kind: 'bodyweight', hidden: true },
  { id: 'ex-decline-situp', name: 'デクラインシットアップ', part: 'core', step: 1, kind: 'bodyweight', hidden: true },
  { id: 'ex-ab-coaster', name: 'アブコースター', part: 'core', step: 1, kind: 'bodyweight', hidden: true },
];

export const DEFAULT_EXERCISES = LIST.map((e, i) => ({
  kind: 'weight',
  note: '',
  hidden: false,
  ...e,
  order: i,
}));

/** 目標提案で使う回数の範囲 */
export const REP_RANGE = { min: 8, max: 12 };

/** 部位ごとの週あたりセット数の目安 */
export const WEEKLY_SET_GUIDE = 10;

/** この日数を超えてバックアップしていなければ知らせる */
export const BACKUP_WARN_DAYS = 30;
