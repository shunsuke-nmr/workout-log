// sw.js の版とキャッシュ対象の一覧が、アプリの版・実際のファイルとずれていないか確かめる。
// ファイルの一覧を読むため Node.js で実行したときだけ動く。

import { test, eq } from './harness.js';
import { APP_VERSION } from '../js/version.js';

if (typeof process !== 'undefined' && process.versions?.node) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

  test('sw.js の VERSION と js/version.js の APP_VERSION が同じ', () => {
    eq(sw.match(/const VERSION = '([^']+)'/)?.[1], APP_VERSION);
  });

  test('js/ の全ファイルが sw.js のキャッシュ対象に入っている', () => {
    const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
    const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
    const missing = walk('js').filter((f) => !listed.has(f));
    eq(missing, []);
  });

  test('キャッシュ対象のファイルがすべて存在する', () => {
    const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
    eq(listed.filter((f) => !fs.existsSync(path.join(root, f))), []);
  });
}
