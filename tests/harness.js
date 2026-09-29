// ブラウザと Node.js の両方で動く、最小限のテスト道具（依存パッケージなし）。

const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err.message });
  }
}

export function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} 期待値 ${e} / 実際 ${a}`);
}

/** 結果を画面（ブラウザ）またはコンソール（Node.js）に出す */
export function report() {
  const failed = results.filter((r) => !r.ok);
  const lines = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.message}`}`);
  const summary = `${results.length - failed.length} / ${results.length} 件成功`;
  if (typeof document !== 'undefined') {
    document.getElementById('out').textContent = `${summary}\n\n${lines.join('\n')}`;
    document.title = failed.length ? `✗ ${failed.length}件失敗` : '✓ すべて成功';
  } else {
    console.log(`${lines.join('\n')}\n\n${summary}`);
    if (failed.length) process.exitCode = 1;
  }
}
