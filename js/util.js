// 日付・数値まわりの小さな道具。日付はすべて端末の現地時刻で 'YYYY-MM-DD' 文字列として扱う。

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // 古いブラウザ向けの予備（crypto.getRandomValues は端末内で完結する）
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** その日を含む週の月曜日 */
export function mondayOf(str) {
  const d = parseDate(str);
  const offset = (d.getDay() + 6) % 7; // 月曜=0
  d.setDate(d.getDate() - offset);
  return toDateStr(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function isValidDateStr(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toDateStr(parseDate(str)) === str;
}

/** '2026-09-30' → '9/30(水)'。withYear で年も付ける */
export function formatDate(str, withYear = false) {
  const d = parseDate(str);
  const md = `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
  return withYear ? `${d.getFullYear()}/${md}` : md;
}

export function weekdayOf(str) {
  return WEEKDAYS[parseDate(str).getDay()];
}

/** 0.01 単位に丸める（0.1 + 0.2 のような誤差を保存しない） */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/** 42.5 → '42.5'、40 → '40' */
export function fmtNum(n) {
  return String(round2(n));
}

export function fmtSet(s) {
  return `${fmtNum(s.weight)}×${s.reps}`;
}
