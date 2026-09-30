// 初期種目と部位の定義のテスト。

import { test, eq } from './harness.js';
import { DEFAULT_EXERCISES, PARTS } from '../js/defaults.js';
import { findInvalid } from '../js/logic/migrate.js';

test('初期種目は16種目で、この順番', () => {
  eq(DEFAULT_EXERCISES.map((e) => e.name), [
    'ラットプルダウン', 'シーテッドロウ', 'DYロウ', 'アシスト懸垂',
    'チェストプレス', 'デクラインプレス', 'ペクトラルフライ',
    'ショルダープレス', 'リアデルトイド', 'サイドレイズ',
    'シーテッドレッグプレス', 'レッグカール', 'レッグエクステンション',
    'アームカール', 'トライセプスプレスダウン',
    'アブドミナルクランチ',
  ]);
  eq(DEFAULT_EXERCISES.map((e) => e.order), [...Array(16).keys()]);
});

test('部位に体幹があり、初期種目の部位はすべて定義済み', () => {
  eq(PARTS.map((p) => p.label), ['背中', '胸', '肩', '脚', '腕', '体幹']);
  const ids = new Set(PARTS.map((p) => p.id));
  eq(DEFAULT_EXERCISES.filter((e) => !ids.has(e.part)).map((e) => e.name), []);
});

test('刻みの初期値：ダンベルの種目は1kg、それ以外は2.5kg', () => {
  const oneKg = DEFAULT_EXERCISES.filter((e) => e.step === 1).map((e) => e.name);
  eq(oneKg, ['サイドレイズ', 'アームカール']);
  eq(DEFAULT_EXERCISES.every((e) => e.step === 1 || e.step === 2.5), true);
});

test('補助の種目はアシスト懸垂だけ', () => {
  eq(DEFAULT_EXERCISES.filter((e) => e.assist).map((e) => e.name), ['アシスト懸垂']);
});

test('初期種目の id は重複しない', () => {
  eq(new Set(DEFAULT_EXERCISES.map((e) => e.id)).size, DEFAULT_EXERCISES.length);
});

test('初期データとして正しい形', () => {
  eq(findInvalid({ exercises: DEFAULT_EXERCISES, sessions: [], sets: [], body: [] }), null);
});
