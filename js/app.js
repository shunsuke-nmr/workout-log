// 起動処理と画面の切り替え。

import { initDb, getMeta, requestPersistence, loadAll, replaceAll } from './db.js';
import { h, clear, alertDialog, confirmDialog } from './ui/dom.js';
import { applyTheme } from './theme.js';
import { appState } from './state.js';
import * as record from './views/record.js';
import * as historyView from './views/history.js';
import * as analysis from './views/analysis.js';
import * as body from './views/body.js';
import * as settings from './views/settings.js';

// window.history と名前がぶつからないように historyView と呼ぶ
const VIEWS = { record, history: historyView, analysis, body, settings };
const DEFAULT_TAB = 'record';

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('view-title');

function currentTab() {
  const tab = location.hash.replace('#', '').split('/')[0];
  return VIEWS[tab] ? tab : DEFAULT_TAB;
}

let renderToken = 0;

export async function showView() {
  const tab = currentTab();
  const token = ++renderToken;
  for (const a of document.querySelectorAll('.tab')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const view = VIEWS[tab];
  titleEl.textContent = view.title;
  document.body.dataset.view = tab;
  const root = h('div', { class: `view-inner view-${tab}` });
  try {
    await view.render(root);
  } catch (err) {
    console.error(err);
    clear(root).append(h('p', { class: 'error' }, `表示できませんでした：${err.message}`));
  }
  // 描画中に別のタブへ移っていたら捨てる
  if (token !== renderToken) return;
  clear(viewEl).append(root);
  viewEl.scrollTop = 0;
}

/** iPhone の Safari のタブで開いているか（ホーム画面から起動したときは navigator.standalone が true） */
function isIosBrowserTab() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && navigator.standalone !== true;
}

function showInstallNotice() {
  const area = document.getElementById('notice-area');
  area.append(
    h('div', { class: 'notice notice-warn', role: 'note' },
      h('strong', {}, 'ホーム画面に追加して使ってください。'),
      ' Safari のタブとホーム画面のアプリは記録の保存場所が別で、Safari 側の記録はしばらく開かないと消されることがあります。',
      h('br'),
      '共有ボタン → 「ホーム画面に追加」'),
  );
}

/**
 * 開発用：パソコンの簡易サーバー（localhost）で ?demo を付けて開いたときだけ架空データを入れる。
 * 公開先では何もしない。
 */
async function maybeLoadDemo() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  if (!local || !params.has('demo')) return;
  history.replaceState(null, '', location.pathname + location.hash);
  const current = await loadAll();
  if (current.sets.length > 0 && !(await confirmDialog('今のデータを消して架空のデモデータを入れますか？', { ok: '入れる', danger: true }))) return;
  const { buildDemoData } = await import('../tools/demo-data.js');
  await replaceAll(buildDemoData());
}

async function start() {
  try {
    await initDb();
  } catch (err) {
    console.error(err);
    await alertDialog(err.message, '起動できませんでした');
    return;
  }
  await maybeLoadDemo();
  applyTheme(await getMeta('theme', 'auto'));
  if (isIosBrowserTab()) showInstallNotice();

  window.addEventListener('hashchange', showView);
  await showView();

  appState.persisted = await requestPersistence();
}

start();
