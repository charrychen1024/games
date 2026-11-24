/* 演出强度：尊重系统“减少动态效果”，也可在菜单里改。简化时不震屏、不闪光、不飞镜，翻月与行军从速；数字、地名、结果照常显示。 */
export const reducedSystem = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
let reduced = (() => { try { const v = localStorage.getItem('nanming:motion'); return v ? v === 'reduced' : reducedSystem; } catch { return reducedSystem; } })();
export const isReduced = () => reduced;
export function setReducedMotion(v: boolean) {
  reduced = v;
  try { localStorage.setItem('nanming:motion', v ? 'reduced' : 'full'); } catch { /* 只在本次有效 */ }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduced', v);
}
if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduced', reduced);
