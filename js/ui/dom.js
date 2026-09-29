// 画面部品を作る小さな道具。innerHTML は使わず、文字は常にテキストとして入れる。

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** ボタン。onclick を受け取り、type=button を付ける */
export function button(label, onclick, cls = '', extra = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick, ...extra }, label);
}

/**
 * ＋−で値を変える入力部品。長押しで連続して変わる。
 * get/set で値を持ち、render(value) で表示を返す。
 */
export function stepper({ value, step, min, max, format, label, onChange }) {
  let current = value;
  const display = h('output', { class: 'stepper-value', 'aria-live': 'polite' });
  const update = (v) => {
    current = Math.min(max, Math.max(min, Math.round(v * 100) / 100));
    display.textContent = format(current);
    onChange?.(current);
  };
  const minus = holdButton('−', () => update(current - step()), `${label}を減らす`);
  const plus = holdButton('＋', () => update(current + step()), `${label}を増やす`);
  display.textContent = format(current);
  const el = h('div', { class: 'stepper', role: 'group', 'aria-label': label }, minus, display, plus);
  return {
    el,
    get: () => current,
    set: (v) => {
      current = v;
      display.textContent = format(v);
    },
  };
}

/** 押している間くり返し反応するボタン（キーボード操作ではクリック1回=1回） */
function holdButton(text, action, ariaLabel) {
  let delayTimer = null;
  let repeatTimer = null;
  const stop = () => {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
    delayTimer = repeatTimer = null;
  };
  const btn = h('button', { type: 'button', class: 'btn stepper-btn', 'aria-label': ariaLabel }, text);
  btn.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    action();
    delayTimer = setTimeout(() => {
      repeatTimer = setInterval(action, 90);
    }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', (ev) => {
    // pointerdown で処理済み。キーボード（detail===0）のときだけここで反応する
    if (ev.detail === 0) action();
  });
  btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  return btn;
}

/**
 * モーダルの確認画面。actions は [{ label, value, kind }] 。
 * value が関数なら押したときに呼び、undefined を返したら閉じない（入力チェック用）。
 * 閉じたときに選んだ値で解決する。背景を押す・Esc なら null。
 */
export function showDialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'dialog-title' });
    let result = null;
    const buttons = actions.map((a) =>
      button(a.label, () => {
        const v = typeof a.value === 'function' ? a.value() : a.value;
        if (v === undefined) return;
        result = v;
        dlg.close();
      }, a.kind ? `btn-${a.kind}` : ''),
    );
    append(dlg, [
      title ? h('h2', { id: 'dialog-title', class: 'dialog-title' }, title) : null,
      body ? h('div', { class: 'dialog-body' }, typeof body === 'string' ? h('p', {}, body) : body) : null,
      h('div', { class: `dialog-actions n${buttons.length}` }, buttons),
    ]);
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export async function confirmDialog(message, { title = '確認', ok = 'OK', danger = false } = {}) {
  const v = await showDialog({
    title,
    body: message,
    actions: [
      { label: 'キャンセル', value: false },
      { label: ok, value: true, kind: danger ? 'danger' : 'primary' },
    ],
  });
  return v === true;
}

export function alertDialog(message, title = 'お知らせ') {
  return showDialog({ title, body: message, actions: [{ label: 'OK', value: true, kind: 'primary' }] });
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/** 複数の選択肢から1つ選ぶボタン群（部位などの選択用） */
export function segmented(options, value, onChange) {
  let current = value;
  const btns = options.map((o) =>
    h('button', {
      type: 'button',
      class: 'seg-btn',
      'aria-pressed': String(o.value === current),
      onclick: () => {
        current = o.value;
        for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.value === String(current)));
        onChange?.(current);
      },
      dataset: { value: String(o.value) },
    }, o.label),
  );
  return { el: h('div', { class: 'segmented', role: 'group' }, btns), get: () => current };
}
