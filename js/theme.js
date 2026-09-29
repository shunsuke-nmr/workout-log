// 表示テーマ：'auto'（端末の設定に合わせる）/ 'light' / 'dark'

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}
