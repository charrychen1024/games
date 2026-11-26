/* 游戏卡牌：带插画的卡面、扇形手牌、选中落印。用于方针、任命、遣使、劝降等抉择。 */
import { h, clear } from './dom';
import { iconPath } from '../render/map';
import { iconSvg } from './icons';
import gsap from 'gsap';
import { hoverPluck, stampSfx } from './audio';

const artCache = new Map<string, string>();

/** 卡面插画：主题色晕染 + 远山 + 大图标 + 云纹边框 */
export function cardArt(icon: string, color: string, seed = 0, bare = false): string {
  const key = icon + color + seed + (bare ? ':bare' : '');
  const hit = artCache.get(key);
  if (hit) return hit;
  const W = 150, H = 104;
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
  const g = cv.getContext('2d')!; g.scale(2, 2);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mix(color, '#f3e6c8', 0.55)); bg.addColorStop(1, mix(color, '#1c1510', 0.35));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 日轮
  const sun = g.createRadialGradient(W * 0.72, H * 0.3, 2, W * 0.72, H * 0.3, 30);
  sun.addColorStop(0, 'rgba(255,240,200,0.8)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  // 远近山
  for (const [y, a, k] of [[H * 0.62, 0.25, 1], [H * 0.78, 0.45, 2]] as const) {
    g.fillStyle = `rgba(20,14,8,${a})`;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, y - Math.abs(Math.sin((x + seed * 13 + k * 40) / 23)) * 16 - Math.sin((x + k * 7) / 9) * 3);
    g.lineTo(W, H); g.fill();
  }
  // 大图标（墨色投影 + 金色）；bare 时只画底景，图标另由动画层画
  if (!bare) {
  g.save(); g.translate(W / 2, H * 0.48);
  const p = iconPath(icon);
  g.scale(58 / 512, 58 / 512); g.translate(-256, -256);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.translate(14, 18); g.fill(p); g.translate(-14, -18);
  g.fillStyle = '#fff3d9'; g.fill(p);
  g.restore();
  }
  // 边框
  g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  g.strokeStyle = 'rgba(240,207,134,0.6)'; g.lineWidth = 1; g.strokeRect(4, 4, W - 8, H - 8);
  const url = cv.toDataURL('image/png');
  artCache.set(key, url);
  return url;
}

export interface Chip { icon: string; text: string; tone?: 'good' | 'bad' | 'plain' }
export interface GameCard {
  id: string;
  title: string;
  sub?: string;
  art: string;            // 图片 URL（插画或人物像）
  portrait?: boolean;     // 人物像竖版
  chips?: Chip[];
  badge?: string;         // 右上角数字（如成功率）
  note?: string;
  disabled?: string;      // 不可选的原因
  on?: boolean;           // 当前所用
  color?: string;
}

const ic = (name: string) => { const sp = h('span', { style: { display: 'contents' } }); sp.innerHTML = iconSvg(name); return sp; };

/** 一手牌：七张以内呈扇形，多则横向翻页。点牌即选，落一方“准”字印。 */
export function cardHand(cards: GameCard[], onPick: (id: string) => void, opts: { stampText?: string } = {}): HTMLElement {
  const fan = cards.length <= 7;
  const wrap = h('div', { class: 'hand' + (fan ? ' fan' : ' rail') });
  const row = h('div', { class: 'hand-row' });
  let picked = false;
  cards.forEach((c, i) => {
    const mid = (cards.length - 1) / 2, k = i - mid;
    const el = h('button', { class: 'gcard' + (c.portrait ? ' pc' : '') + (c.on ? ' on' : '') + (c.disabled ? ' off' : ''), 'data-card': c.id, style: { '--rot': fan ? `${k * 3.2}deg` : '0deg', '--dy': fan ? `${Math.abs(k) ** 1.6 * 5}px` : '0px', '--cc': c.color ?? '#8c6a35' } as any,
      'data-tip': c.disabled ?? undefined,
      onmouseenter: () => { if (!c.disabled) hoverPluck(i); },
      onclick: () => {
        if (picked || c.disabled) return;
        picked = true;
        stampSfx();
        const seal = h('div', { class: 'gc-stamp' }, opts.stampText ?? '准');
        el.append(seal);
        el.classList.add('chosen');
        gsap.fromTo(seal, { scale: 3, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: -12, duration: 0.28, ease: 'back.out(2)' });
        gsap.to(row.querySelectorAll('.gcard:not(.chosen)'), { opacity: 0.25, y: 30, duration: 0.3 });
        gsap.to(el, { y: -26, scale: 1.08, duration: 0.3, ease: 'power2.out' });
        setTimeout(() => onPick(c.id), 520);
      } },
    h('div', { class: 'gc-art' + (c.portrait ? ' tall' : '') }, h('img', { src: c.art, alt: '', draggable: 'false' }), c.badge ? h('span', { class: 'gc-badge' }, c.badge) : null, c.on ? h('span', { class: 'gc-cur' }, '现行') : null),
    h('div', { class: 'gc-title' }, c.title),
    c.sub ? h('div', { class: 'gc-sub' }, c.sub) : null,
    c.chips?.length ? h('div', { class: 'gc-chips' }, ...c.chips.map(ch => h('span', { class: 'gc-chip ' + (ch.tone ?? 'plain') }, ic(ch.icon), ch.text))) : null,
    c.note ? h('div', { class: 'gc-note' }, c.note) : null);
    row.append(el);
  });
  wrap.append(row);
  if (!fan) {
    const step = (d: number) => row.scrollBy({ left: d * 340, behavior: 'smooth' });
    wrap.append(h('button', { class: 'hand-nav l', 'aria-label': '向左', onclick: () => step(-1) }, '‹'), h('button', { class: 'hand-nav r', 'aria-label': '向右', onclick: () => step(1) }, '›'));
    row.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); row.scrollBy({ left: e.deltaY }); } }, { passive: false });
  }
  requestAnimationFrame(() => gsap.from(row.querySelectorAll('.gcard'), { y: 120, opacity: 0, rotate: 0, duration: 0.5, stagger: 0.05, ease: 'back.out(1.4)', clearProps: 'transform,opacity' }));
  return wrap;
}

export function emptyHand(text: string): HTMLElement { return h('div', { class: 'hand-empty' }, text); }
export { clear };

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
