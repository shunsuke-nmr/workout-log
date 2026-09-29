// 日付は端末の現地時刻で扱う（toISOString は UTC なので、日本時間の朝9時前に前日になってしまう）。

import { test, eq } from './harness.js';
import { toDateStr, mondayOf, addDays, formatDate, round2, isValidDateStr } from '../js/util.js';

test('朝7時（UTCではまだ前日）でも当日の日付になる', () => {
  eq(toDateStr(new Date(2026, 8, 30, 7, 0)), '2026-09-30');
});
test('深夜0時ちょうどは新しい日', () => {
  eq(toDateStr(new Date(2026, 8, 30, 0, 0, 0)), '2026-09-30');
});
test('23時59分はその日のまま', () => {
  eq(toDateStr(new Date(2026, 8, 29, 23, 59, 59)), '2026-09-29');
});
test('週の区切り：日曜23時59分はその週（月曜始まり）', () => {
  eq(mondayOf(toDateStr(new Date(2026, 9, 4, 23, 59))), '2026-09-28');
});
test('週の区切り：月曜0時からは新しい週', () => {
  eq(mondayOf(toDateStr(new Date(2026, 9, 5, 0, 0))), '2026-10-05');
});
test('週の区切り：月曜朝7時は同じ月曜の週', () => {
  eq(mondayOf(toDateStr(new Date(2026, 9, 5, 7, 0))), '2026-10-05');
});
test('日付の足し算は月・年をまたげる', () => {
  eq(addDays('2026-12-31', 1), '2027-01-01');
  eq(addDays('2026-03-01', -1), '2026-02-28');
});
test('日付の表示', () => {
  eq(formatDate('2026-09-30'), '9/30(水)');
  eq(formatDate('2026-09-30', true), '2026/9/30(水)');
});
test('日付の形式チェック', () => {
  eq(isValidDateStr('2026-02-29'), false);
  eq(isValidDateStr('2028-02-29'), true);
  eq(isValidDateStr('2026-9-1'), false);
});
test('重さは0.01単位に丸める', () => {
  eq(round2(0.1 + 0.2), 0.3);
  eq(round2(40 + 1.25 + 1.25), 42.5);
});
