// 初期種目と部位の定義のテスト。

import { test, eq } from './harness.js';
import { DEFAULT_EXERCISES, PARTS } from '../js/defaults.js';
import { findInvalid } from '../js/logic/migrate.js';

const names = (list) => list.map((e) => e.name);
const shown = DEFAULT_EXERCISES.filter((e) => !e.hidden);
const byPart = (part, list = DEFAULT_EXERCISES) => names(list.filter((e) => e.part === part));

test('部位は 背中・胸・肩・脚・お尻・腕・体幹', () => {
  eq(PARTS.map((p) => p.label), ['背中', '胸', '肩', '脚', 'お尻', '腕', '体幹']);
});

test('初期種目は43種目、最初から表示するのは16種目', () => {
  eq([DEFAULT_EXERCISES.length, shown.length], [43, 16]);
});

test('最初から表示する種目と順番', () => {
  eq(byPart('back', shown), ['ラットプルダウン', 'シーテッドロウ', 'DYロウ', 'アシスト懸垂']);
  eq(byPart('chest', shown), ['チェストプレス', 'デクラインプレス', 'ペクトラルフライ']);
  eq(byPart('shoulder', shown), ['ショルダープレス', 'リアデルトイド', 'サイドレイズ']);
  eq(byPart('leg', shown), ['シーテッドレッグプレス', 'レッグカール', 'レッグエクステンション']);
  eq(byPart('glute', shown), []);
  eq(byPart('arm', shown), ['アームカール', 'トライセプスプレスダウン']);
  eq(byPart('core', shown), ['アブドミナルクランチ']);
});

test('部位ごとの全種目と順番（非表示を含む）', () => {
  eq(byPart('back'), ['ラットプルダウン', 'シーテッドロウ', 'DYロウ', 'アシスト懸垂', 'ワンハンドロウ', 'デッドリフト', '45度バックエクステンション']);
  eq(byPart('chest'), ['チェストプレス', 'デクラインプレス', 'ペクトラルフライ', 'ベンチプレス', 'スミスベンチプレス', 'ダンベルプレス', 'インクラインダンベルプレス', 'ダンベルフライ', 'ケーブルクロスオーバー']);
  eq(byPart('shoulder'), ['ショルダープレス', 'リアデルトイド', 'サイドレイズ', 'ショルダープレス（プレート式）', 'ダンベルショルダープレス', 'ケーブルサイドレイズ', 'フェイスプル']);
  eq(byPart('leg'), ['シーテッドレッグプレス', 'レッグカール', 'レッグエクステンション', 'リニアレッグプレス', 'スクワット', 'スミススクワット', 'ヒップアダクション']);
  eq(byPart('glute'), ['ヒップアブダクション', 'ブーティービルダー']);
  eq(byPart('arm'), ['アームカール', 'トライセプスプレスダウン', 'プリーチャーカール', 'ハンマーカール', 'ケーブルカール', 'アシストディップス']);
  eq(byPart('core'), ['アブドミナルクランチ', 'トーソローテーション', 'レッグレイズ', 'デクラインシットアップ', 'アブコースター']);
});

test('種類：補助は2種目、自重は4種目、ほかは通常', () => {
  eq(names(DEFAULT_EXERCISES.filter((e) => e.kind === 'assist')), ['アシスト懸垂', 'アシストディップス']);
  eq(names(DEFAULT_EXERCISES.filter((e) => e.kind === 'bodyweight')),
    ['45度バックエクステンション', 'レッグレイズ', 'デクラインシットアップ', 'アブコースター']);
  eq(DEFAULT_EXERCISES.every((e) => ['weight', 'assist', 'bodyweight'].includes(e.kind)), true);
});

test('刻みの初期値：1kg の種目', () => {
  eq(names(DEFAULT_EXERCISES.filter((e) => e.step === 1)), [
    'ワンハンドロウ', '45度バックエクステンション', 'ダンベルプレス', 'インクラインダンベルプレス', 'ダンベルフライ',
    'サイドレイズ', 'ダンベルショルダープレス', 'アームカール', 'プリーチャーカール', 'ハンマーカール',
    'レッグレイズ', 'デクラインシットアップ', 'アブコースター',
  ]);
  eq(DEFAULT_EXERCISES.every((e) => e.step === 1 || e.step === 2.5), true);
});

test('並び順は通し番号、id と名前は重複しない', () => {
  eq(DEFAULT_EXERCISES.map((e) => e.order), [...Array(DEFAULT_EXERCISES.length).keys()]);
  eq(new Set(DEFAULT_EXERCISES.map((e) => e.id)).size, DEFAULT_EXERCISES.length);
  eq(new Set(names(DEFAULT_EXERCISES)).size, DEFAULT_EXERCISES.length);
});

test('初期種目の部位はすべて定義済み', () => {
  const ids = new Set(PARTS.map((p) => p.id));
  eq(names(DEFAULT_EXERCISES.filter((e) => !ids.has(e.part))), []);
});

test('初期データとして正しい形', () => {
  eq(findInvalid({ exercises: DEFAULT_EXERCISES, sessions: [], sets: [], body: [] }), null);
});
