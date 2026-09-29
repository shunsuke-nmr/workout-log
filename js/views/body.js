// 体重・お腹周り画面（段階3で実装）

import { h, clear } from '../ui/dom.js';

export const title = '体重・お腹周り';

export async function render(root) {
  clear(root).append(h('p', { class: 'muted' }, '準備中です'));
}
