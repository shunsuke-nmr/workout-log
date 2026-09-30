// 書き出し・バックアップ・復元のテスト。数値はすべて架空。

import { test, eq } from './harness.js';
import { makeData } from './progression.test.js';
import {
  analysisText, buildBackup, parseBackup, mergeData, backupStatus, backupFileName,
} from '../js/logic/exporter.js';

test('バックアップを作って読み戻すと同じ内容', () => {
  const data = makeData([['2026-09-01', [[40, 10], [40, 9]]]]);
  data.body.push({ id: 'b1', date: '2026-09-01', weightKg: 60, waistCm: null });
  const backup = buildBackup(data, '1.0.0', new Date(2026, 8, 30, 7, 0));
  const parsed = parseBackup(JSON.stringify(backup));
  eq(parsed.data, data);
  eq(parsed.exportedAt, new Date(2026, 8, 30, 7, 0).getTime());
});

test('ファイル名は現地の日付', () => {
  eq(backupFileName('2026-09-30'), 'workout-log-backup-2026-09-30.json');
});

test('ほかのアプリのJSONや壊れたファイルは断る', () => {
  const msg = (text) => { try { parseBackup(text); return ''; } catch (e) { return e.message; } };
  eq(msg('{ broken'), 'JSON として読めないファイルです');
  eq(msg('{"app":"other","data":{}}'), 'このアプリのバックアップではありません');
  eq(msg(JSON.stringify({ app: 'workout-log', schemaVersion: 99, data: {} })).includes('新しい版'), true);
});

test('統合：同じidは今のデータを優先し、ないものだけ足す', () => {
  const current = makeData([['2026-09-01', [[40, 10]]]]);
  const incoming = makeData([['2026-09-01', [[99, 99]]], ['2026-09-04', [[42.5, 8]]]]);
  const { data, added } = mergeData(current, incoming);
  eq(added, { exercises: 0, sessions: 1, sets: 1, body: 0 });
  eq(data.sets.find((s) => s.id === 's0-0').weight, 40);
});

test('統合：名前が同じ種目は同じ種目として扱う', () => {
  const current = makeData([['2026-09-01', [[40, 10]]]], 'local-id');
  const incoming = makeData([['2026-08-01', [[35, 10]]]], 'other-id');
  incoming.sessions[0].id = 'x0';
  incoming.sets[0].id = 'x0-0';
  incoming.sets[0].sessionId = 'x0';
  const { data, added } = mergeData(current, incoming);
  eq(added.exercises, 0);
  eq(data.sets.find((s) => s.id === 'x0-0').exerciseId, 'local-id');
});

test('統合：新しい種目は並び順の最後に足す', () => {
  const current = makeData([], 'a');
  const incoming = makeData([], 'b');
  incoming.exercises[0].name = '種目B';
  const { data } = mergeData(current, incoming);
  eq(data.exercises.map((e) => [e.id, e.order]), [['a', 0], ['b', 1]]);
});

test('統合：同じ日の体重は今のデータを優先', () => {
  const current = makeData([]);
  current.body.push({ id: 'b1', date: '2026-09-01', weightKg: 60, waistCm: null });
  const incoming = makeData([]);
  incoming.body.push({ id: 'b2', date: '2026-09-01', weightKg: 61, waistCm: null });
  incoming.body.push({ id: 'b3', date: '2026-09-08', weightKg: 59.8, waistCm: null });
  const { data } = mergeData(current, incoming);
  eq(data.body.map((b) => b.id), ['b1', 'b3']);
});

test('バックアップの警告：30日以上で知らせる', () => {
  const at = new Date(2026, 7, 31, 23, 30).getTime(); // 8/31 23:30（現地）
  eq(backupStatus(at, true, '2026-09-29', 30), { lastDate: '2026-08-31', days: 29, warn: false });
  eq(backupStatus(at, true, '2026-09-30', 30).warn, true);
  eq(backupStatus(null, true, '2026-09-30', 30).warn, true);
  eq(backupStatus(null, false, '2026-09-30', 30).warn, false);
});

test('分析用の文章で補助の種目には（補助）を付け、自己ベストは最小の補助', () => {
  const data = makeData([['2026-09-25', [[25, 10]]], ['2026-09-28', [[22.5, 8], [25, 12]]]]);
  data.exercises[0].name = 'アシスト懸垂';
  data.exercises[0].assist = true;
  const text = analysisText(data, '2026-09-30');
  eq(text.includes('- アシスト懸垂（補助）：22.5×8, 25×12'), true);
  eq(text.includes('| アシスト懸垂（補助） | 背中 | 2 | 25×10 | 22.5×8 | 22.5×8 | 更新中 |'), true);
  eq(text.includes('重さが小さいほど良い'), true);
});

test('分析用の文章に日付・種目・セット・体重が入る', () => {
  const data = makeData([['2026-09-28', [[40, 12], [40, 11]]]]);
  data.body.push({ id: 'b1', date: '2026-09-28', weightKg: 60.5, waistCm: null });
  const text = analysisText(data, '2026-09-30');
  eq(text.includes('### 2026-09-28（月）'), true);
  eq(text.includes('- 種目A：40×12, 40×11'), true);
  eq(text.includes('| 2026-09-28 | 60.5 | - |'), true);
  eq(text.includes('| 2026-09-28 | 2 | 0 | 0 | 0 | 0 |'), true);
});
