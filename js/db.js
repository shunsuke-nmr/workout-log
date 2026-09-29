// IndexedDB への保存。記録データはこの端末のブラウザの中にだけ置く。
// データ量は多くても数千件なので、画面を描くたびに loadAll() で全件読み、計算はメモリ上で行う。

import { DEFAULT_EXERCISES } from './defaults.js';
import { SCHEMA_VERSION, STORES, migrate, findInvalid } from './logic/migrate.js';

const DB_NAME = 'workout-log';
// IndexedDB 自体の版（ストアや索引を増やすときに上げる）。データの中身の版は SCHEMA_VERSION で別に管理する
const IDB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('sets')) {
        const s = db.createObjectStore('sets', { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId');
        s.createIndex('exerciseId', 'exerciseId');
      }
      if (!db.objectStoreNames.contains('body')) {
        db.createObjectStore('body', { keyPath: 'id' }).createIndex('date', 'date');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 別タブで新しい版が開かれたら閉じて譲る
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('データベースが別の画面で使用中です。他のタブを閉じてください'));
  });
  return dbPromise;
}

/**
 * トランザクションを1つ実行する。work には同期的にリクエストを積む関数を渡す
 * （Safari で途中に await を挟むとトランザクションが先に閉じるのを避けるため）。
 * work が返した関数を完了時に呼び、その戻り値を結果にする。
 */
async function run(storeNames, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let getResult;
    tx.oncomplete = () => resolve(getResult ? getResult() : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存が中断されました'));
    try {
      getResult = work(tx);
    } catch (err) {
      tx.abort();
      reject(err);
    }
  });
}

export async function loadAll() {
  return run(STORES, 'readonly', (tx) => {
    const reqs = STORES.map((s) => tx.objectStore(s).getAll());
    return () => Object.fromEntries(STORES.map((s, i) => [s, reqs[i].result]));
  });
}

export async function put(store, record) {
  await run([store], 'readwrite', (tx) => {
    tx.objectStore(store).put(record);
  });
  return record;
}

export async function putMany(store, records) {
  await run([store], 'readwrite', (tx) => {
    const os = tx.objectStore(store);
    for (const r of records) os.put(r);
  });
}

export async function remove(store, id) {
  await run([store], 'readwrite', (tx) => {
    tx.objectStore(store).delete(id);
  });
}

/** トレーニング日を、そこに含まれるセットごと削除する */
export async function removeSession(sessionId) {
  await run(['sessions', 'sets'], 'readwrite', (tx) => {
    tx.objectStore('sessions').delete(sessionId);
    const idx = tx.objectStore('sets').index('sessionId');
    idx.openCursor(IDBKeyRange.only(sessionId)).onsuccess = (ev) => {
      const cur = ev.target.result;
      if (cur) {
        cur.delete();
        cur.continue();
      }
    };
  });
}

export async function getMeta(key, fallback = undefined) {
  const value = await run(['meta'], 'readonly', (tx) => {
    const req = tx.objectStore('meta').get(key);
    return () => req.result?.value;
  });
  return value === undefined ? fallback : value;
}

export async function setMeta(key, value) {
  await run(['meta'], 'readwrite', (tx) => {
    tx.objectStore('meta').put({ key, value });
  });
}

/** 全データを data で置き換える（復元の「上書き」、移行、全削除で使う）。1つのトランザクションで行うので途中で失敗しても元のまま */
export async function replaceAll(data) {
  await run([...STORES, 'meta'], 'readwrite', (tx) => {
    for (const s of STORES) {
      const os = tx.objectStore(s);
      os.clear();
      for (const r of data[s]) os.put(r);
    }
    tx.objectStore('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  });
}

export function defaultData() {
  return {
    exercises: DEFAULT_EXERCISES.map((e) => ({ ...e })),
    sessions: [],
    sets: [],
    body: [],
  };
}

/**
 * 起動時の準備。初回なら初期種目を入れ、古い版のデータなら移行する。
 * 戻り値は { firstRun } 。
 */
export async function initDb() {
  const version = await getMeta('schemaVersion');
  if (version === undefined) {
    await replaceAll(defaultData());
    return { firstRun: true };
  }
  if (version < SCHEMA_VERSION) {
    const migrated = migrate(await loadAll(), version);
    const problem = findInvalid(migrated);
    if (problem) throw new Error(`データの移行に失敗しました：${problem}`);
    await replaceAll(migrated);
  } else if (version > SCHEMA_VERSION) {
    throw new Error('このデータは新しい版のアプリで保存されています。ページを再読み込みして更新してください');
  }
  return { firstRun: false };
}

/** 保存領域の永続化を要求する（ブラウザが容量不足のときに勝手に消さないように）。結果: true / false / null(非対応) */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
