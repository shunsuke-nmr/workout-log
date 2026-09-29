// 履歴画面（段階3で実装）

import { h, clear } from '../ui/dom.js';

export const title = '履歴';

export async function render(root) {
  clear(root).append(h('p', { class: 'muted' }, '準備中です'));
}
