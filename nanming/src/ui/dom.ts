/* 极简 DOM 工具 */
type Attrs = Record<string, any>;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) if (val !== undefined && val !== null) { if (p.startsWith('--')) el.style.setProperty(p, String(val)); else (el.style as any)[p] = val; } }
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
export function clear(el: HTMLElement) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN');
export function wan(n: number): string {
  if (Math.abs(n) >= 10000) return (Math.round(n / 1000) / 10).toString().replace(/\.0$/, '') + ' 万';
  return Math.round(n).toLocaleString('zh-CN');
}
export function signed(n: number, unit = ''): string { const r = Math.round(n * 10) / 10; return (r > 0 ? '+' : '') + (Math.abs(r) >= 10000 ? wan(r) : r.toLocaleString('zh-CN')) + unit; }
