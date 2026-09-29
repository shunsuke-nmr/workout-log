// 起動処理と画面の切り替え。

import { initDb, getMeta, requestPersistence } from './db.js';
import { h, clear, alertDialog } from './ui/dom.js';
import { applyTheme } from './theme.js';
import { appState } from './state.js';
import * as record from './views/record.js';
import * as history from './views/history.js';
import * as analysis from './views/analysis.js';
import * as body from './views/body.js';
import * as settings from './views/settings.js';

const VIEWS = { record, history, analysis, body, settings };
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

async function start() {
  try {
    await initDb();
  } catch (err) {
    console.error(err);
    await alertDialog(err.message, '起動できませんでした');
    return;
  }
  applyTheme(await getMeta('theme', 'auto'));
  if (isIosBrowserTab()) showInstallNotice();

  window.addEventListener('hashchange', showView);
  await showView();

  appState.persisted = await requestPersistence();
}

start();
