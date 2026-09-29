// 端末の外へ出す操作（コピー・ファイル保存）。どちらも利用者がボタンを押したときだけ呼ぶ。

/** クリップボードにコピーする。成功したら true */
export async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 下の方法を試す
    }
  }
  // http で開いている確認用サーバーなど、Clipboard API が使えない場合
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.className = 'visually-hidden';
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * ファイルを保存する。
 * iPhone などで共有シートが使えるときは navigator.share で共有（「ファイルに保存」を選べる）、
 * 使えないときはダウンロードにする。
 * 戻り値: 'shared' | 'downloaded' | 'cancelled'
 */
export async function saveFile(content, fileName, type) {
  const file = new File([content], fileName, { type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // 共有に失敗したらダウンロードを試す
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
