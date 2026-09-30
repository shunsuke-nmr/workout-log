// 記録画面と履歴画面で共通の、セットと日付の修正ダイアログ。

import { put, remove } from '../db.js';
import { h, stepper, showDialog, toast } from './dom.js';
import { todayStr, formatDate, fmtNum, isValidDateStr, round2 } from '../util.js';

/** トレーニングの日付を変える。変えたら true */
export async function editSessionDate(session) {
  const input = h('input', { class: 'text-input', type: 'date', value: session.date, max: todayStr() });
  const result = await showDialog({
    title: 'トレーニングの日付',
    body: h('label', { class: 'field' }, h('span', { class: 'field-label' }, '日付'), input),
    actions: [
      { label: 'キャンセル', value: null },
      { label: '保存', value: () => (isValidDateStr(input.value) ? input.value : undefined), kind: 'primary' },
    ],
  });
  if (!result || result === session.date) return false;
  await put('sessions', { ...session, date: result });
  toast(`日付を ${formatDate(result)} にしました`);
  return true;
}

/** セットを修正または削除する。変えたら true */
export async function editSet(set, exercise, index) {
  const step = exercise?.step ?? 2.5;
  const assist = !!exercise?.assist;
  const weight = stepper({
    value: set.weight,
    step: () => step,
    min: 0,
    max: 500,
    label: assist ? '補助の重さ' : '重さ',
    format: (v) => (assist ? `補助 ${fmtNum(v)} kg` : `${fmtNum(v)} kg`),
  });
  const reps = stepper({
    value: set.reps, step: () => 1, min: 1, max: 100, label: '回数', format: (v) => `${v} 回`,
  });
  const result = await showDialog({
    title: `${exercise?.name ?? '種目'}　${index + 1}セット目`,
    body: h('div', { class: 'edit-set' }, weight.el, reps.el),
    actions: [
      { label: 'このセットを削除', value: 'delete', kind: 'danger-outline' },
      { label: 'キャンセル', value: null },
      { label: '保存', value: 'save', kind: 'primary' },
    ],
  });
  if (result === 'save') {
    await put('sets', { ...set, weight: round2(weight.get()), reps: reps.get() });
    toast('修正しました');
    return true;
  }
  if (result === 'delete') {
    await remove('sets', set.id);
    toast('削除しました');
    return true;
  }
  return false;
}
