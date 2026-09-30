// 種目の種類。
//   weight     通常：重さ（kg）と回数。重いほど良い
//   assist     補助：補助の重さと回数（アシスト懸垂など）。補助が軽いほど良い
//   bodyweight 自重：回数が中心。重さは加重した分だけ（0 = 加重なし）

import { fmtNum } from '../util.js';

export const KINDS = [
  { id: 'weight', label: '通常' },
  { id: 'assist', label: '補助' },
  { id: 'bodyweight', label: '自重' },
];

export const KIND_IDS = KINDS.map((k) => k.id);

/**
 * 種目の種類を返す。
 * 1.0.1 までに保存された種目は kind を持たないので、assist: true なら補助、それ以外は通常として扱う
 * （保存済みのデータは書き換えない）。
 */
export function exKind(ex) {
  if (ex && KIND_IDS.includes(ex.kind)) return ex.kind;
  return ex?.assist ? 'assist' : 'weight';
}

/** セットの表示。通常・補助「40×12」、自重「12回」／加重あり「+5×12」 */
export function fmtSetKind(kind, s) {
  if (!s) return '';
  if (kind === 'bodyweight') return s.weight > 0 ? `+${fmtNum(s.weight)}×${s.reps}` : `${s.reps}回`;
  return `${fmtNum(s.weight)}×${s.reps}`;
}

/** 自己ベストなどの詳しい表示。「40kg × 12回」「補助27.5kg × 9回」「加重+5kg × 12回」「12回」 */
export function fmtBestKind(kind, s) {
  if (!s) return 'なし';
  if (kind === 'assist') return `補助${fmtNum(s.weight)}kg × ${s.reps}回`;
  if (kind === 'bodyweight') return s.weight > 0 ? `加重+${fmtNum(s.weight)}kg × ${s.reps}回` : `${s.reps}回`;
  return `${fmtNum(s.weight)}kg × ${s.reps}回`;
}

/** 重さの入力欄の名前と表示 */
export function weightInputFor(kind) {
  if (kind === 'assist') return { label: '補助の重さ', format: (v) => `補助 ${fmtNum(v)} kg` };
  if (kind === 'bodyweight') return { label: '加重', format: (v) => (v > 0 ? `加重 +${fmtNum(v)} kg` : '加重なし') };
  return { label: '重さ', format: (v) => `${fmtNum(v)} kg` };
}

/** 分析用の文章などで種目名に付ける印 */
export function kindSuffix(kind) {
  return kind === 'assist' ? '（補助）' : kind === 'bodyweight' ? '（自重）' : '';
}
