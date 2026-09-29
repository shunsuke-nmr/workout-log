// 記録画面（段階2で実装）

import { h, clear } from '../ui/dom.js';

export const title = '記録';

export async function render(root) {
  clear(root).append(h('p', { class: 'muted' }, '準備中です'));
}
