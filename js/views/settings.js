// 設定画面：種目の管理、表示テーマ、（段階4で）書き出し・バックアップ。

import { loadAll, put, putMany, getMeta, setMeta, replaceAll, defaultData } from '../db.js';
import { PARTS, PART_LABEL, WEIGHT_STEPS } from '../defaults.js';
import { h, clear, button, showDialog, confirmDialog, alertDialog, segmented, toast } from '../ui/dom.js';
import { copyText, saveFile } from '../ui/share.js';
import { applyTheme } from '../theme.js';
import { appState } from '../state.js';
import { APP_VERSION } from '../version.js';
import { refreshBackupDot, backupWarningText } from '../backup-status.js';
import {
  analysisText, buildBackup, backupFileName, parseBackup, mergeData, countData,
} from '../logic/exporter.js';
import { fmtNum, formatDate, toDateStr, todayStr, uid } from '../util.js';

export const title = '設定';

export async function render(root) {
  const data = await loadAll();
  const theme = await getMeta('theme', 'auto');
  const backup = await refreshBackupDot(data);
  const rerender = () => render(root);

  clear(root).append(
    exportSection(data, backup, rerender),
    exerciseSection(data.exercises, rerender),
    themeSection(theme),
    dangerSection(rerender),
    aboutSection(),
  );
}

// ───────── 書き出し・バックアップ ─────────

function exportSection(data, backup, rerender) {
  const counts = countData(data);

  const copy = async () => {
    const ok = await copyText(analysisText(data, todayStr()));
    if (ok) toast('コピーしました。Claude などに貼り付けて使えます');
    else alertDialog('コピーできませんでした。');
  };

  // 共有シートは「ボタンを押した直後」でないと開けないので、ここで待たずにファイルを作る
  const save = async () => {
    const json = JSON.stringify(buildBackup(data, APP_VERSION), null, 1);
    const result = await saveFile(json, backupFileName(todayStr()), 'application/json');
    if (result === 'cancelled') return;
    await setMeta('lastBackupAt', Date.now());
    toast(result === 'shared' ? 'バックアップを保存しました' : 'バックアップをダウンロードしました');
    rerender();
  };

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    tabindex: '-1',
    'aria-hidden': 'true',
    onchange: async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (file) await restore(file, rerender);
    },
  });

  return h('section', {},
    h('h2', { class: 'section-title' }, '書き出しとバックアップ'),
    backup.warn
      ? h('div', { class: 'notice notice-warn notice-inline', role: 'note' },
        backupWarningText(backup), '記録が消えたときのために「バックアップを保存」してください。')
      : null,
    h('div', { class: 'card stack' },
      h('p', { class: 'muted small' },
        `記録：トレーニング${counts.sessions}回・${counts.sets}セット・体重など${counts.body}件`, h('br'),
        `最後のバックアップ：${backup.lastDate ? `${formatDate(backup.lastDate, true)}（${backup.days}日前）` : 'まだありません'}`),
      button('分析用にコピー', copy, 'btn-block'),
      h('p', { class: 'muted small' }, '全記録を文章にしてコピーします。Claude に貼って分析してもらうときに使います。'),
      button('バックアップを保存', save, 'btn-primary btn-block'),
      h('p', { class: 'muted small' }, 'iPhone では共有画面が開くので「“ファイル”に保存」を選んでください。'),
      button('バックアップから復元', () => fileInput.click(), 'btn-block'),
      fileInput,
    ),
  );
}

async function restore(file, rerender) {
  let parsed;
  try {
    parsed = parseBackup(await file.text());
  } catch (err) {
    await alertDialog(err.message, '復元できません');
    return;
  }
  const c = countData(parsed.data);
  const when = parsed.exportedAt ? `${formatDate(toDateStr(new Date(parsed.exportedAt)), true)} に保存した` : '';
  const mode = await showDialog({
    title: 'バックアップから復元',
    body: h('div', {},
      h('p', {}, `${when}バックアップ：トレーニング${c.sessions}回・${c.sets}セット・体重など${c.body}件`),
      h('p', { class: 'muted small' }, '統合：今の記録を残したまま、バックアップにしかない記録を足します。\n上書き：今の記録をすべて消して、バックアップの内容に置き換えます。'),
    ),
    actions: [
      { label: '上書きする', value: 'replace', kind: 'danger-outline' },
      { label: 'キャンセル', value: null },
      { label: '統合する', value: 'merge', kind: 'primary' },
    ],
  });
  if (!mode) return;

  if (mode === 'replace') {
    const ok = await confirmDialog('今の記録はすべて消えて、バックアップの内容に置き換わります。元に戻せません。', {
      title: '上書きして復元', ok: '上書きする', danger: true,
    });
    if (!ok) return;
    await replaceAll(parsed.data);
    toast('バックアップの内容に置き換えました');
  } else {
    const current = await loadAll();
    const { data, added } = mergeData(current, parsed.data);
    const ok = await confirmDialog(
      `トレーニング${added.sessions}回・${added.sets}セット・体重など${added.body}件・種目${added.exercises}個を追加します。`,
      { title: '統合して復元', ok: '統合する' },
    );
    if (!ok) return;
    await replaceAll(data);
    toast('統合しました');
  }
  rerender();
}

// ───────── 全データ削除（二段階の確認） ─────────

function dangerSection(rerender) {
  const wipe = async () => {
    const first = await confirmDialog('記録・体重・種目の設定をすべて削除します。先にバックアップを保存しておくことをおすすめします。', {
      title: '全データを削除', ok: '次へ', danger: true,
    });
    if (!first) return;
    const second = await confirmDialog('本当に削除しますか？ この操作は元に戻せません。', {
      title: '最終確認', ok: '完全に削除する', danger: true,
    });
    if (!second) return;
    await replaceAll(defaultData());
    await setMeta('lastBackupAt', null);
    await setMeta('activeSessionId', null);
    toast('すべてのデータを削除しました');
    rerender();
  };
  return h('section', {},
    h('h2', { class: 'section-title' }, '全データの削除'),
    h('div', { class: 'card' }, button('全データを削除', wipe, 'btn-danger-outline btn-block')),
  );
}

function aboutSection() {
  const persisted = appState.persisted === true
    ? '保護されています（ブラウザが容量不足でも自動では消されません）'
    : appState.persisted === false
      ? '保護されていません（ホーム画面から開くと保護されやすくなります）'
      : '確認できません';
  return h('section', {},
    h('h2', { class: 'section-title' }, 'このアプリについて'),
    h('div', { class: 'card small' },
      h('p', {}, `バージョン ${APP_VERSION}`),
      h('p', {}, `保存領域：${persisted}`),
      h('p', { class: 'muted' }, '記録はこの端末のブラウザの中にだけ保存され、外部には送信されません。書き出しやバックアップをしたときだけ端末の外に出ます。'),
    ),
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
