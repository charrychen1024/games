/* 配乐的乐理部分（纯函数，可测）：五声调式、乐句生成、局势紧张度。
 * 宫商角徵羽五调；乐句以级进为主，偶有跳进，句末落在调式主音上，长音收束，句中留白。 */
import { makeRng, type Rng } from '../core/rng';
import type { GameState } from '../core/types';
import { hostile, topOf } from '../core/state';
import { neighbors } from '../data/geography';

export type Mode = 'gong' | 'shang' | 'jue' | 'zhi' | 'yu';
/** 五声音阶相对宫音的半音数 */
const PENTA = [0, 2, 4, 7, 9];
const MODE_DEG: Record<Mode, number> = { gong: 0, shang: 1, jue: 2, zhi: 3, yu: 4 };
export const MODE_NAME: Record<Mode, string> = { gong: '宫', shang: '商', jue: '角', zhi: '徵', yu: '羽' };

/** 宫音为 gongMidi 的五声音阶在 [lo, hi] 内的全部音（MIDI），以及调式主音所在位置 */
export function scale(gongMidi: number, mode: Mode, lo: number, hi: number): { notes: number[]; tonics: number[] } {
  const notes: number[] = [];
  for (let m = lo; m <= hi; m++) if (PENTA.includes(((m - gongMidi) % 12 + 12) % 12)) notes.push(m);
  const tonicPc = ((gongMidi + PENTA[MODE_DEG[mode]]) % 12 + 12) % 12;
  const tonics = notes.map((m, i) => (m % 12 === tonicPc ? i : -1)).filter(i => i >= 0);
  return { notes, tonics };
}

export interface Note { midi: number | null; beats: number; accent?: boolean; orn?: 'slide' | 'vib' | 'trem' }

const RHYTHMS = [[2, 1, 1], [1, 1, 2], [3, 1], [1.5, 0.5, 2], [1, 1, 1, 1], [2, 2], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 2]];

/** 生成一句：总长 bars 小节（每小节四拍），级进为主，句末落主音长音 */
export function phrase(rng: Rng, sc: { notes: number[]; tonics: number[] }, bars: number, opts: { start?: number; rest?: number; busy?: number } = {}): Note[] {
  const out: Note[] = [];
  const total = bars * 4;
  let idx = opts.start ?? sc.tonics[Math.floor(sc.tonics.length / 2)] ?? Math.floor(sc.notes.length / 2);
  let t = 0;
  const pickRhythm = () => {
    const pool = opts.busy && opts.busy > 0.5 ? RHYTHMS.filter(r => r.length >= 3) : RHYTHMS;
    return pool[Math.floor(rng.next() * pool.length)];
  };
  while (t < total - 2) {
    for (const b of pickRhythm()) {
      if (t + b > total - 2) break;
      if (rng.next() < (opts.rest ?? 0.1) && out.length) { out.push({ midi: null, beats: b }); t += b; continue; }
      const r = rng.next();
      const step = r < 0.55 ? 1 : r < 0.82 ? 2 : 3;
      const dir = rng.next() < 0.5 ? -1 : 1;
      idx = Math.max(0, Math.min(sc.notes.length - 1, idx + dir * step));
      out.push({ midi: sc.notes[idx], beats: b, accent: t % 4 === 0, orn: b >= 2 ? (rng.next() < 0.5 ? 'vib' : 'slide') : undefined });
      t += b;
    }
  }
  // 收束：就近的主音，长音
  const near = sc.tonics.slice().sort((a, b) => Math.abs(a - idx) - Math.abs(b - idx))[0] ?? idx;
  out.push({ midi: sc.notes[near], beats: total - t, accent: true, orn: 'vib' });
  return out;
}

/** 一段旋律：主题 A、A 的变奏、对比句 B、再回 A，便于记住 */
export function melody(seed: number, sc: { notes: number[]; tonics: number[] }, bars = 4, opts: { rest?: number; busy?: number } = {}): Note[][] {
  const rng = makeRng(seed);
  const a = phrase(rng, sc, bars, opts);
  const b = phrase(rng, sc, bars, { ...opts, start: Math.min(sc.notes.length - 1, (sc.tonics[0] ?? 0) + 3) });
  const vary = (p: Note[]) => p.map((n, i) => (n.midi !== null && i % 3 === 1 && rng.next() < 0.5 ? { ...n, midi: sc.notes[Math.max(0, Math.min(sc.notes.length - 1, sc.notes.indexOf(n.midi) + (rng.next() < 0.5 ? 1 : -1)))] } : n));
  return [a, vary(a), b, vary(a)];
}

export const beatsOf = (p: Note[]) => p.reduce((n, x) => n + x.beats, 0);

/** 局势紧张度 0—1：本方城池被围、敌军压境、急报、刚丢的城 */
export function dangerOf(s: GameState): number {
  const me = topOf(s, s.player);
  const mine = Object.values(s.cities).filter(c => topOf(s, c.controller) === me);
  if (!mine.length) return 1;
  let d = 0;
  for (const c of mine) if (s.sieges[c.id]) d += c.id === s.factions[s.player].capital ? 0.45 : 0.18;
  const front = new Set<string>();
  for (const a of Object.values(s.armies)) {
    if (!hostile(s, a.faction, s.player)) continue;
    for (const c of mine) if (a.location === c.id || neighbors(c.id).some(n => n.to === a.location)) { front.add(c.id); break; }
  }
  d += Math.min(0.35, front.size * 0.06);
  d += Math.min(0.25, s.reports.filter(r => r.turn === s.turn - 1 && r.urgent && (!r.faction || r.faction === s.player)).length * 0.06);
  d += Math.min(0.3, Object.keys(s.flags).filter(k => k.startsWith('lost_') && !k.startsWith('lost_how') && !k.startsWith('lost_caught') && s.flags[k] === s.turn - 1).length * 0.05);
  return Math.max(0, Math.min(1, d));
}

/** 各家配乐的调式与音色 */
export function paletteOf(polity: string): { gong: number; mode: Mode; lead: 'qin' | 'pipa' | 'zheng' | 'dizi'; color: 'literati' | 'steppe' | 'folk' | 'sea' } {
  switch (polity) {
    case 'qing': return { gong: 55, mode: 'zhi', lead: 'dizi', color: 'steppe' };
    case 'shun': return { gong: 57, mode: 'shang', lead: 'pipa', color: 'folk' };
    case 'xi': return { gong: 52, mode: 'yu', lead: 'pipa', color: 'folk' };
    case 'helan': return { gong: 60, mode: 'gong', lead: 'zheng', color: 'sea' };
    default: return { gong: 50, mode: 'gong', lead: 'qin', color: 'literati' };
  }
}
