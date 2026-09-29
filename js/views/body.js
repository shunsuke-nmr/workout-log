// 体重・お腹周りの記録と推移。どちらか片方だけでも記録できる。

import { loadAll, put, remove } from '../db.js';
import { h, clear, button, confirmDialog, toast } from '../ui/dom.js';
import { lineChart } from '../ui/chart.js';
import { bodySeries } from '../logic/stats.js';
import { formatDate, fmtNum, isValidDateStr, todayStr, uid } from '../util.js';

export const title = '体重・お腹周り';

const LIMITS = { weightKg: [20, 300], waistCm: [30, 250] };

/** 入力欄の文字を数値にする。空なら null、範囲外や数字でなければ NaN */
export function parseMeasure(text, [min, max]) {
  const t = text.trim().replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  const n = Math.round(Number(t) * 10) / 10;
  return n >= min && n <= max ? n : NaN;
}

export async function render(root) {
  const data = await loadAll();
  const rerender = () => render(root);
  const entries = [...data.body].sort((a, b) => (a.date < b.date ? 1 : -1));

  clear(root).append(
    inputCard(entries, rerender),
    h('div', { class: 'card' },
      h('h3', { class: 'chart-title' }, '体重'),
      lineChart({
        points: bodySeries(data.body, 'weightKg'),
        format: (v, axis) => (axis ? fmtNum(v) : `${fmtNum(v)}kg`),
        label: '体重の推移',
      })),
    h('div', { class: 'card' },
      h('h3', { class: 'chart-title' }, 'お腹周り'),
      lineChart({
        points: bodySeries(data.body, 'waistCm'),
        format: (v, axis) => (axis ? fmtNum(v) : `${fmtNum(v)}cm`),
        label: 'お腹周りの推移',
      })),
    entryList(entries, rerender),
  );
}

function inputCard(entries, rerender) {
  const last = entries[0];
  const date = h('input', { class: 'text-input', type: 'date', value: todayStr(), max: todayStr() });
  const numberInput = (placeholder) => h('input', {
    class: 'text-input num',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    placeholder,
  });
  const weight = numberInput(last?.weightKg != null ? `前回 ${fmtNum(last.weightKg)}` : '例 65.0');
  const waist = numberInput(last?.waistCm != null ? `前回 ${fmtNum(last.waistCm)}` : '例 80.0');
  const error = h('p', { class: 'error small', role: 'alert' });
  error.hidden = true;

  const save = async () => {
    const w = parseMeasure(weight.value, LIMITS.weightKg);
    const c = parseMeasure(waist.value, LIMITS.waistCm);
    const problem = !isValidDateStr(date.value) ? '日付を選んでください'
      : Number.isNaN(w) ? `体重は ${LIMITS.weightKg.join('〜')} の数字で入れてください`
        : Number.isNaN(c) ? `お腹周りは ${LIMITS.waistCm.join('〜')} の数字で入れてください`
          : w == null && c == null ? '体重かお腹周りのどちらかを入れてください'
            : null;
    if (problem) {
      error.textContent = problem;
      error.hidden = false;
      return;
    }
    // 同じ日の記録があれば、入れた方の値だけ上書きする
    const existing = entries.find((e) => e.date === date.value);
    const record = existing ? { ...existing } : { id: uid(), date: date.value, weightKg: null, waistCm: null };
    if (w != null) record.weightKg = w;
    if (c != null) record.waistCm = c;
    await put('body', record);
    toast(existing ? `${formatDate(record.date)} の記録を更新しました` : '記録しました');
    rerender();
  };

  return h('section', { class: 'card body-input' },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '日付'), date),
    h('div', { class: 'body-fields' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, '体重（kg）'), weight),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'お腹周り（cm）'), waist),
    ),
    error,
    button('記録する', save, 'btn-primary btn-lg btn-block'),
  );
}

function entryList(entries, rerender) {
  if (entries.length === 0) return null;
  return h('section', {},
    h('h2', { class: 'section-title' }, '記録の一覧'),
    h('ul', { class: 'list card' }, entries.map((e) => h('li', { class: 'list-item' },
      h('div', { class: 'list-main' },
        h('div', { class: 'name' }, formatDate(e.date, true)),
        h('div', { class: 'sub num' },
          [e.weightKg != null ? `体重 ${fmtNum(e.weightKg)}kg` : null, e.waistCm != null ? `お腹周り ${fmtNum(e.waistCm)}cm` : null]
            .filter(Boolean).join('・')),
      ),
      button('削除', async () => {
        if (!(await confirmDialog(`${formatDate(e.date, true)} の記録を削除しますか？`, { ok: '削除する', danger: true }))) return;
        await remove('body', e.id);
        toast('削除しました');
        rerender();
      }, 'btn-danger-outline'),
    ))),
  );
}
