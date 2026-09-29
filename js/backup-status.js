// バックアップの状況を読み、30日以上たっていれば設定タブに印を付ける。

import { getMeta, loadAll } from './db.js';
import { BACKUP_WARN_DAYS } from './defaults.js';
import { backupStatus } from './logic/exporter.js';
import { todayStr } from './util.js';

export async function getBackupStatus(data) {
  const d = data ?? (await loadAll());
  const hasRecords = d.sets.length > 0 || d.body.length > 0;
  return backupStatus(await getMeta('lastBackupAt', null), hasRecords, todayStr(), BACKUP_WARN_DAYS);
}

export function backupWarningText(status) {
  return status.lastDate
    ? `最後のバックアップから${status.days}日たっています。`
    : 'まだ一度もバックアップしていません。';
}

export async function refreshBackupDot(data) {
  const status = await getBackupStatus(data);
  const dot = document.getElementById('settings-dot');
  if (dot) dot.hidden = !status.warn;
  return status;
}
