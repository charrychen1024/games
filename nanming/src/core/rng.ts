/* 可复现的随机数：同一种子、同一组键，永远得到同一串数。
 * 每月、每场战斗各自派生随机流，玩家在战斗中的选择不会扰动其他结算。 */

export function hashKeys(...keys: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const k of keys) {
    const s = String(k);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(lo: number, hi: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** 以 1 为中心、±spread 的扰动系数 */
  jitter(spread: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    jitter: (s) => 1 + (next() * 2 - 1) * s,
  };
}

export function rngFor(seed: number, ...keys: (string | number)[]): Rng {
  return makeRng(hashKeys(seed, ...keys));
}
