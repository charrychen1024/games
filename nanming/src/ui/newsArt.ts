/* 战报卡的动态插画：底景（远山日轮）+ 图标层 + 光晕 + 粒子 + 扫光。
 * 每换一条军报，图标按类别入场（军报交锋震颤、易主落印、交涉飘来、内政锤击、史事放光、线索搜寻、急报红光），
 * 入场之后有轻微的循环动作；人物像则缓推镜头并扫光。减少动态效果时只淡入、不循环。 */
import gsap from 'gsap';
import { h } from './dom';
import { iconSvg } from './icons';
import { cardArt } from './cards';
import { isReduced } from './motion';
import { scene as mkScene, type SceneKind, type SceneOpts } from './scene';

export type ArtCat = '急报' | '军报' | '易主' | '交涉' | '内政' | '人事' | '史事' | '线索';
/** 每类的动作名，写在元素上便于测试与调样式 */
/** 每类的动作名（有场景时为 scene-场景名） */
export const ART_MOTION: Record<ArtCat, string> = { 急报: 'alarm', 军报: 'clash', 易主: 'stamp', 交涉: 'drift', 内政: 'hammer', 人事: 'portrait', 史事: 'radiance', 线索: 'search' };

export interface NewsArt {
  el: HTMLElement;
  show(o: { cat: ArtCat; icon: string; color: string; seed: number; portrait?: string; scene?: { kind: SceneKind; opts?: SceneOpts } }): void;
  stop(): void;
}

export function newsArt(): NewsArt {
  const bg = h('img', { class: 'na-bg', alt: '', draggable: 'false' }) as HTMLImageElement;
  const rays = h('div', { class: 'na-rays' });
  const glow = h('div', { class: 'na-glow' });
  const ring = h('div', { class: 'na-ring' });
  const ico = h('div', { class: 'na-ico' });
  const fx = h('div', { class: 'na-fx' });
  const shine = h('div', { class: 'na-shine' });
  const el = h('div', { class: 'nw-art na' }, bg, rays, glow, ring, ico, fx, shine);
  let tl: gsap.core.Timeline | null = null;
  let sc: { el: HTMLElement; stop(): void } | null = null;
  let loops: (gsap.core.Tween | gsap.core.Timeline)[] = [];

  const stop = () => {
    sc?.stop(); sc?.el.remove(); sc = null; el.classList.remove('has-scene');
    tl?.kill(); tl = null;
    loops.forEach(x => x.kill()); loops = [];
    gsap.killTweensOf([bg, rays, glow, ring, ico, shine]);
    fx.replaceChildren();
  };
  /** 一簇粒子：从 (x,y)（百分比）向外迸或向上飘 */
  const burst = (n: number, o: { x: number; y: number; color: string; spread: number; rise?: number; size?: number; dur?: number; delay?: number }) => {
    for (let k = 0; k < n; k++) {
      const p = h('i', { class: 'na-p', style: { left: o.x + '%', top: o.y + '%', background: o.color, width: (o.size ?? 4) + 'px', height: (o.size ?? 4) + 'px' } });
      fx.append(p);
      const a = Math.random() * Math.PI * 2, d = o.spread * (0.5 + Math.random() * 0.5);
      gsap.fromTo(p, { x: 0, y: 0, opacity: 1, scale: 1 }, {
        x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7 - (o.rise ?? 0), opacity: 0, scale: 0.3,
        duration: (o.dur ?? 0.7) * (0.7 + Math.random() * 0.6), delay: (o.delay ?? 0) + Math.random() * 0.08, ease: 'power2.out', onComplete: () => p.remove(),
      });
    }
  };
  /** 慢慢上浮的光点（交涉、史事、线索的氛围） */
  const motes = (color: string, every = 0.35) => {
    const t = gsap.to({}, { duration: every, repeat: -1, onRepeat: () => burst(1, { x: 20 + Math.random() * 60, y: 70 + Math.random() * 20, color, spread: 10, rise: 50, size: 3, dur: 2.2 }) });
    loops.push(t);
  };

  const show: NewsArt['show'] = o => {
    stop();
    const reduced = isReduced();
    el.dataset.motion = ART_MOTION[o.cat];
    // 有场景（城破、议和、交兵）：整幅换成会动的小画
    if (o.scene) {
      sc = mkScene(o.scene.kind, o.scene.opts);
      sc.el.classList.add('na-scene');
      el.classList.add('has-scene');
      el.dataset.motion = 'scene-' + o.scene.kind;
      el.append(sc.el);
      if (!isReduced()) gsap.fromTo(sc.el, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' });
      return;
    }
    el.classList.toggle('pt', !!o.portrait);
    bg.src = o.portrait ?? cardArt(o.icon, o.color, o.seed, true);
    ico.innerHTML = o.portrait ? '' : iconSvg(o.icon);
    el.style.setProperty('--na-c', o.color);
    gsap.set([ico, glow, ring, rays, shine], { clearProps: 'all' });
    if (reduced) { gsap.fromTo(el, { opacity: 0.4 }, { opacity: 1, duration: 0.2 }); return; }

    tl = gsap.timeline();
    // 底景：缓推镜头；扫光一次
    tl.fromTo(bg, { scale: 1.22 }, { scale: 1, duration: 3.4, ease: 'power1.out' }, 0);
    tl.fromTo(shine, { xPercent: -160, opacity: 1 }, { xPercent: 160, duration: 0.9, ease: 'power2.inOut' }, o.cat === '易主' ? 0.45 : 0.25);

    if (o.portrait) {
      tl.fromTo(bg, { filter: 'brightness(1.6) saturate(0.4)' }, { filter: 'brightness(1) saturate(1)', duration: 0.6 }, 0);
      tl.fromTo(glow, { opacity: 0.8, scale: 0.6 }, { opacity: 0, scale: 1.6, duration: 0.8 }, 0);
      motes('rgba(255,236,190,0.9)', 0.5);
      return;
    }
    const pulseGlow = (min = 0.45, max = 0.85, d = 1.1) => loops.push(gsap.fromTo(glow, { opacity: min, scale: 0.92 }, { opacity: max, scale: 1.08, duration: d, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    switch (o.cat) {
      case '军报': {
        // 两刃自两侧撞入，交击处火星四溅，随后刀光微颤
        tl.fromTo(ico, { scale: 1.9, opacity: 0, rotate: -25 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.32, ease: 'power3.in' }, 0.05)
          .add(() => burst(16, { x: 50, y: 46, color: '#ffb347', spread: 60, size: 4 }), 0.37)
          .fromTo(el, { x: -5 }, { x: 0, duration: 0.35, ease: 'elastic.out(1.2,0.3)' }, 0.37)
          .fromTo(glow, { opacity: 1, scale: 1.4 }, { opacity: 0.5, scale: 1, duration: 0.5 }, 0.37);
        tl.add(() => {
          loops.push(gsap.to(ico, { rotate: 4, duration: 0.09, yoyo: true, repeat: -1, repeatDelay: 1.3, ease: 'none' }));
          loops.push(gsap.to({}, { duration: 1.4, repeat: -1, onRepeat: () => burst(6, { x: 50, y: 46, color: '#ffcf70', spread: 40, size: 3 }) }));
          pulseGlow(0.4, 0.75, 0.7);
        }, 0.8);
        break;
      }
      case '易主': {
        // 大印自上方砸下，尘环散开，地动
        tl.fromTo(ico, { scale: 2.6, opacity: 0, y: -30 }, { scale: 1, opacity: 1, y: 0, duration: 0.36, ease: 'power4.in' }, 0.05)
          .fromTo(ring, { scale: 0.3, opacity: 0.95 }, { scale: 2.1, opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.41)
          .add(() => burst(14, { x: 50, y: 62, color: 'rgba(230,210,170,0.9)', spread: 70, size: 5, dur: 0.9 }), 0.41)
          .fromTo(el, { y: 4 }, { y: 0, duration: 0.4, ease: 'bounce.out' }, 0.41);
        tl.add(() => { loops.push(gsap.to(ico, { y: -3, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })); pulseGlow(); }, 1);
        break;
      }
      case '交涉': {
        // 使节自左飘来，上下浮动，金色光点上升
        tl.fromTo(ico, { x: -70, opacity: 0, rotate: -10 }, { x: 0, opacity: 1, rotate: 0, duration: 0.8, ease: 'power3.out' }, 0.05);
        tl.add(() => {
          loops.push(gsap.to(ico, { y: -6, rotate: 3, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
          pulseGlow(0.35, 0.7, 1.6);
          motes('rgba(255,226,150,0.95)');
        }, 0.85);
        break;
      }
      case '内政': {
        // 自下而起，随后像锤击般一顿一顿，每击迸出木屑火星
        tl.fromTo(ico, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, 0.05);
        tl.add(() => {
          const hit = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
          hit.to(ico, { rotate: -16, y: -4, duration: 0.22, ease: 'power2.out' })
            .to(ico, { rotate: 6, y: 2, duration: 0.1, ease: 'power3.in' })
            .add(() => burst(5, { x: 55, y: 66, color: '#ffd27a', spread: 26, size: 3, dur: 0.5 }))
            .to(ico, { rotate: 0, y: 0, duration: 0.25, ease: 'power1.out' });
          loops.push(hit);
          pulseGlow(0.35, 0.65, 0.9);
        }, 0.6);
        break;
      }
      case '史事': {
        // 光芒缓转，图标呼吸放光
        tl.fromTo(rays, { opacity: 0, scale: 0.6 }, { opacity: 0.85, scale: 1, duration: 0.8, ease: 'power2.out' }, 0)
          .fromTo(ico, { scale: 0.5, opacity: 0, filter: 'brightness(2.2)' }, { scale: 1, opacity: 1, filter: 'brightness(1)', duration: 0.8, ease: 'back.out(1.6)' }, 0.1);
        tl.add(() => {
          loops.push(gsap.to(rays, { rotate: 360, duration: 24, repeat: -1, ease: 'none' }));
          loops.push(gsap.to(ico, { scale: 1.06, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
          pulseGlow(0.45, 0.9, 1.5);
          motes('rgba(255,240,200,0.9)', 0.45);
        }, 0.9);
        break;
      }
      case '线索': {
        // 如持镜搜寻：沿小圈游移
        tl.fromTo(ico, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 0.05);
        tl.add(() => {
          const path = gsap.timeline({ repeat: -1 });
          path.to(ico, { x: 10, y: -6, rotate: 8, duration: 0.9, ease: 'sine.inOut' })
            .to(ico, { x: -8, y: -2, rotate: -6, duration: 1.1, ease: 'sine.inOut' })
            .to(ico, { x: 0, y: 4, rotate: 0, duration: 0.9, ease: 'sine.inOut' });
          loops.push(path);
          pulseGlow(0.3, 0.6, 1.3);
          motes('rgba(180,220,255,0.9)', 0.5);
        }, 0.5);
        break;
      }
      case '急报': {
        // 红光闪动，图标急颤，警环一圈圈外扩
        tl.fromTo(ico, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power3.out' }, 0.05)
          .fromTo(ico, { x: -4 }, { x: 4, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, 0.3);
        tl.add(() => {
          loops.push(gsap.fromTo(ring, { scale: 0.5, opacity: 0.9 }, { scale: 2, opacity: 0, duration: 1.1, repeat: -1, ease: 'power1.out' }));
          loops.push(gsap.fromTo(glow, { opacity: 0.4 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
          loops.push(gsap.to(ico, { scale: 1.08, duration: 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
        }, 0.7);
        break;
      }
      default:
        tl.fromTo(ico, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4 }, 0.05);
        tl.add(() => pulseGlow(), 0.5);
    }
  };
  return { el, show, stop };
}
