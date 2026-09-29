// 起動処理と画面の切り替え。

import { initDb, getMeta, requestPersistence, loadAll, replaceAll } from './db.js';
import { h, clear, alertDialog, confirmDialog } from './ui/dom.js';
import { applyTheme } from './theme.js';
import { appState } from './state.js';
import { refreshBackupDot } from './backup-status.js';
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

/**
 * Service Worker を登録し、新しい版が届いたら画面下に知らせる。
 * 切り替えは利用者が［更新］を押したときだけ（記録の途中で勝手に再読み込みしないように）。
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let updateRequested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });

  const showUpdate = (worker) => {
    const area = document.getElementById('notice-area');
    if (area.querySelector('.notice-update')) return;
    area.append(h('div', { class: 'notice notice-update', role: 'status' },
      h('span', {}, '新しい版があります。'),
      h('button', {
        type: 'button',
        class: 'btn btn-primary',
        onclick: () => {
          updateRequested = true;
          worker.postMessage('skipWaiting');
        },
      }, '更新する')));
  };

  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
    // ホーム画面のアプリは開きっぱなしになりやすいので、表に戻るたびに新しい版を確かめる
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service Worker を登録できませんでした', err));
}

async function start() {
  registerServiceWorker();
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
  await refreshBackupDot();

  appState.persisted = await requestPersistence();
}

start();
