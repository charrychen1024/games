/* 游戏化控件：代替浏览器原生下拉框、数字框，外观与漆木 HUD 一致，键盘也能操作。 */
import { h, clear, fmt } from './dom';
import gsap from 'gsap';

export interface SelOpt { value: string; label: string; sub?: string; color?: string; tag?: string; disabled?: boolean }
export type GameSelect = HTMLElement & { value: string; setOptions(o: SelOpt[]): void };

let openSel: { close(): void } | null = null;
document.addEventListener('pointerdown', e => { if (openSel && !(e.target as HTMLElement).closest?.('.gsel, .gsel-list')) openSel.close(); }, true);
window.addEventListener('resize', () => openSel?.close());
/** 关闭任何展开的下拉（弹窗关闭时调用） */
export function closeSelects() { openSel?.close(); }

/** 下拉选择：按钮 + 浮层列表 */
export function gameSelect(id: string, options: SelOpt[], value: string, onChange?: (v: string) => void): GameSelect {
  let opts = options;
  let cur = value && opts.some(o => o.value === value) ? value : (opts.find(o => !o.disabled)?.value ?? '');
  let hi = -1;
  const label = h('span', { class: 'gsel-cur' });
  const btn = h('button', { type: 'button', class: 'gsel-btn', 'aria-haspopup': 'listbox' }, label, h('i', { class: 'gsel-caret' }));
  const list = h('div', { class: 'gsel-list hidden', role: 'listbox' });
  const root = h('div', { class: 'gsel', id }, btn) as unknown as GameSelect;
  const paintCur = () => {
    const o = opts.find(x => x.value === cur);
    clear(label).append(o?.color ? h('i', { class: 'gsel-dot', style: { background: o.color } }) : '', h('b', null, o?.label ?? '—'), o?.sub ? h('small', null, o.sub) : '');
  };
  const items = () => [...list.querySelectorAll<HTMLElement>('.gsel-opt')];
  const paintHi = () => items().forEach((el, i) => el.classList.toggle('hi', i === hi));
  const build = () => {
    clear(list);
    for (const o of opts) list.append(h('button', { type: 'button', class: 'gsel-opt' + (o.value === cur ? ' on' : ''), role: 'option', 'data-value': o.value, disabled: o.disabled,
      onclick: (e: Event) => { e.stopPropagation(); pick(o.value); } },
    o.color ? h('i', { class: 'gsel-dot', style: { background: o.color } }) : null, h('b', null, o.label), o.sub ? h('small', null, o.sub) : null, o.tag ? h('em', null, o.tag) : null));
  };
  const close = () => { list.classList.add('hidden'); list.remove(); root.classList.remove('open'); if (openSel?.close === close) openSel = null; };
  const open = () => {
    openSel?.close();
    build();
    // 浮层挂在页面最上层，按按钮位置摆放；下方放不下就向上展开
    document.body.append(list);
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 200 && above > below;
    const maxH = Math.min(300, up ? above : below);
    Object.assign(list.style, { left: r.left + 'px', width: r.width + 'px', maxHeight: maxH + 'px', top: up ? '' : (r.bottom + 4) + 'px', bottom: up ? (window.innerHeight - r.top + 4) + 'px' : '' });
    list.classList.remove('hidden'); root.classList.add('open');
    openSel = { close };
    hi = opts.findIndex(o => o.value === cur);
    paintHi();
    items()[hi]?.scrollIntoView({ block: 'nearest' });
    gsap.fromTo(list, { opacity: 0, y: -6, scaleY: 0.92 }, { opacity: 1, y: 0, scaleY: 1, duration: 0.18, ease: 'power2.out', transformOrigin: up ? 'bottom' : 'top' });
  };
  const pick = (v: string) => {
    if (opts.find(o => o.value === v)?.disabled) return;
    const changed = v !== cur;
    cur = v; paintCur(); close();
    if (changed) onChange?.(v);
  };
  btn.onclick = () => (root.classList.contains('open') ? close() : open());
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (!root.classList.contains('open')) {
      if (k === 'ArrowDown' || k === 'Enter' || k === ' ') { e.preventDefault(); open(); }
      return;
    }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
    else if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      const n = opts.length; let i = hi;
      for (let t = 0; t < n; t++) { i = (i + (k === 'ArrowDown' ? 1 : -1) + n) % n; if (!opts[i].disabled) break; }
      hi = i; paintHi(); items()[hi]?.scrollIntoView({ block: 'nearest' });
    } else if (k === 'Enter') { e.preventDefault(); if (opts[hi]) pick(opts[hi].value); btn.focus(); }
  };
  root.addEventListener('keydown', onKey);
  list.addEventListener('keydown', onKey);
  Object.defineProperty(root, 'value', { get: () => cur, set: (v: string) => { if (opts.some(o => o.value === v)) { cur = v; paintCur(); } } });
  root.setOptions = (o: SelOpt[]) => { opts = o; if (!opts.some(x => x.value === cur)) cur = opts.find(x => !x.disabled)?.value ?? ''; paintCur(); };
  paintCur();
  return root;
}

export type Stepper = HTMLElement & { value: number; setMax(n: number): void };
/** 数量：− 数字 + ，下附快捷档位；不出现浏览器原生的数字框箭头 */
export function stepper(id: string, value: number, opts: { step: number; min?: number; max: number; unit?: string; presets?: number[]; onChange?: (v: number) => void }): Stepper {
  let v = value, max = opts.max;
  const min = opts.min ?? 0;
  const out = h('input', { class: 'stp-v', id, inputmode: 'numeric', 'aria-label': '数量' }) as HTMLInputElement;
  const set = (n: number, fire = true) => {
    v = Math.max(min, Math.min(max, Math.round(n / opts.step) * opts.step || 0));
    out.value = fmt(v);
    root.querySelectorAll<HTMLButtonElement>('.stp-chip').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === v || (b.dataset.v === 'max' && v === max)));
    if (fire) opts.onChange?.(v);
  };
  let hold = 0;
  const btn = (d: number, t: string) => {
    const b = h('button', { type: 'button', class: 'stp-b', 'aria-label': d > 0 ? '加' : '减' }, t);
    const fire = () => set(v + d * opts.step);
    const stop = () => clearInterval(hold);
    // 按住连加：弹窗被关掉（按钮离开文档）或指针被收走时一定停下
    b.addEventListener('pointerdown', () => { stop(); fire(); let k = 0; hold = window.setInterval(() => { if (!b.isConnected) { stop(); return; } k++; set(v + d * opts.step * (k > 8 ? 5 : 1)); }, 120); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, stop);
    return b;
  };
  out.addEventListener('change', () => set(Number(out.value.replace(/[^\d]/g, '')) || 0));
  out.addEventListener('focus', () => out.select());
  out.addEventListener('wheel', e => { e.preventDefault(); set(v + (e.deltaY < 0 ? 1 : -1) * opts.step); }, { passive: false });
  const chips = h('div', { class: 'stp-chips' });
  for (const p of opts.presets ?? []) chips.append(h('button', { type: 'button', class: 'stp-chip', 'data-v': String(p), onclick: () => set(p) }, p === 0 ? '无' : fmt(p)));
  if (opts.presets) chips.append(h('button', { type: 'button', class: 'stp-chip', 'data-v': 'max', onclick: () => set(max) }, '全部'));
  const root = h('div', { class: 'stp' }, h('div', { class: 'stp-row' }, btn(-1, '−'), out, opts.unit ? h('span', { class: 'stp-u' }, opts.unit) : null, btn(1, '+')), opts.presets ? chips : null) as unknown as Stepper;
  Object.defineProperty(root, 'value', { get: () => v, set: (n: number) => set(n, false) });
  root.setMax = (n: number) => { max = Math.max(min, n); set(v, false); };
  set(v, false);
  return root;
}
