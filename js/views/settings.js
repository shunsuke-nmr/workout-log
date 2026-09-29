// 設定画面：種目の管理、表示テーマ、（段階4で）書き出し・バックアップ。

import { loadAll, put, putMany, getMeta, setMeta } from '../db.js';
import { PARTS, PART_LABEL, WEIGHT_STEPS } from '../defaults.js';
import { h, clear, button, showDialog, segmented, toast } from '../ui/dom.js';
import { applyTheme } from '../theme.js';
import { fmtNum, uid } from '../util.js';

export const title = '設定';

export async function render(root) {
  const data = await loadAll();
  const theme = await getMeta('theme', 'auto');
  const rerender = () => render(root);

  clear(root).append(
    exerciseSection(data.exercises, rerender),
    themeSection(theme),
  );
}

function sortedExercises(exercises) {
  return [...exercises].sort((a, b) => a.order - b.order);
}

function exerciseSection(exercises, rerender) {
  const list = sortedExercises(exercises);

  const move = async (index, dir) => {
    const a = list[index];
    const b = list[index + dir];
    if (!b) return;
    // 並び順を振り直してから入れ替える（order の重複や欠番があっても崩れないように）
    const reordered = list.map((e, i) => ({ ...e, order: i }));
    reordered[index].order = index + dir;
    reordered[index + dir].order = index;
    await putMany('exercises', reordered);
    rerender();
    toast(`「${a.name}」を${dir < 0 ? '上' : '下'}へ移動しました`);
  };

  const items = list.map((e, i) =>
    h('li', { class: 'list-item' },
      h('div', { class: 'list-main' },
        h('div', { class: 'name' }, e.name, e.hidden ? ' ' : null, e.hidden ? h('span', { class: 'badge' }, '非表示') : null),
        h('div', { class: 'sub' }, `${PART_LABEL[e.part] ?? e.part}・${fmtNum(e.step)}kg刻み`),
      ),
      button('↑', () => move(i, -1), 'icon-btn', { 'aria-label': `${e.name}を上へ`, disabled: i === 0 }),
      button('↓', () => move(i, 1), 'icon-btn', { 'aria-label': `${e.name}を下へ`, disabled: i === list.length - 1 }),
      button('編集', async () => {
        const saved = await editExercise(e, exercises);
        if (saved) rerender();
      }),
    ),
  );

  return h('section', {},
    h('h2', { class: 'section-title' }, '種目'),
    h('div', { class: 'card' },
      h('ul', { class: 'list' }, items),
      button('＋ 種目を追加', async () => {
        const saved = await editExercise(null, exercises);
        if (saved) rerender();
      }, 'btn-block'),
    ),
  );
}

/** 種目の追加・編集。保存したら true */
async function editExercise(ex, allExercises) {
  const isNew = !ex;
  const nameInput = h('input', {
    class: 'text-input',
    type: 'text',
    value: ex?.name ?? '',
    maxlength: '30',
    autocomplete: 'off',
    enterkeyhint: 'done',
  });
  const part = segmented(PARTS.map((p) => ({ value: p.id, label: p.label })), ex?.part ?? 'back');
  const step = segmented(WEIGHT_STEPS.map((s) => ({ value: s, label: fmtNum(s) })), ex?.step ?? 2.5);
  const hidden = h('input', { type: 'checkbox', checked: !!ex?.hidden });
  const errorEl = h('p', { class: 'error small', role: 'alert' });
  errorEl.hidden = true;

  const body = h('div', {},
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '名前'), nameInput),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '部位'), part.el),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '重さの刻み（kg）'), step.el),
    isNew ? null : h('label', { class: 'check' }, hidden, '記録画面に表示しない'),
    errorEl,
  );

  const collect = () => {
    const name = nameInput.value.trim();
    const problem = !name
      ? '名前を入れてください'
      : allExercises.some((o) => o.id !== ex?.id && o.name === name)
        ? '同じ名前の種目があります'
        : null;
    if (problem) {
      errorEl.textContent = problem;
      errorEl.hidden = false;
      return undefined; // ダイアログを閉じない
    }
    return {
      ...(ex ?? {
        id: uid(),
        order: allExercises.reduce((m, o) => Math.max(m, o.order), -1) + 1,
        hidden: false,
      }),
      name,
      part: part.get(),
      step: Number(step.get()),
      hidden: isNew ? false : hidden.checked,
    };
  };

  if (isNew) setTimeout(() => nameInput.focus(), 50);
  const result = await showDialog({
    title: isNew ? '種目を追加' : '種目を編集',
    body,
    actions: [
      { label: 'キャンセル', value: null },
      { label: '保存', value: collect, kind: 'primary' },
    ],
  });
  if (!result) return false;
  await put('exercises', result);
  toast(isNew ? `「${result.name}」を追加しました` : '保存しました');
  return true;
}

function themeSection(theme) {
  const seg = segmented(
    [
      { value: 'auto', label: '端末に合わせる' },
      { value: 'light', label: 'ライト' },
      { value: 'dark', label: 'ダーク' },
    ],
    theme,
    async (v) => {
      applyTheme(v);
      await setMeta('theme', v);
    },
  );
  return h('section', {},
    h('h2', { class: 'section-title' }, '表示'),
    h('div', { class: 'card' }, seg.el),
  );
}
