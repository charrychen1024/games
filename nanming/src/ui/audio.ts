/* 声音：全部由 WebAudio 实时合成，不用任何录音文件。
 * 乐器：古琴、琵琶、古筝（拨弦，Karplus-Strong 算法）；箫、笛（气声 + 颤音）；二胡（擦弦）；唢呐；大鼓、堂鼓、梆子、锣、钹、磬、钟、号角。
 * 环境：风、鸟、浪、战场喧声。
 * 配乐分场景：标题、地图（按势力换调式与主奏乐器，按局势紧张度加层）、战斗（随回合加剧）、终局；场景之间交叉淡入淡出。
 * 浏览器要求先有一次用户操作才能出声：首次点击或按键时启动。 */
import { scale, melody, beatsOf, paletteOf, MAP_ERAS, type Mode, type Note } from './musicTheory';
import { makeRng } from '../core/rng';

let ctx: AudioContext | null = null;
/* 混响按声部分开：配乐的混响回到配乐总线、音效的混响回到音效总线，滑杆拉到零，连同余响一起归零 */
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, ambBus: GainNode, duckBus: GainNode, musicSend: GainNode, sfxSend: GainNode;
let muted = false;
let musicVol = 0.55, sfxVol = 0.8, ambVol = 0.5;
const num = (v: string | null, d: number) => { const n = Number(v ?? d); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d; };
try {
  muted = localStorage.getItem('nanming:muted') === '1';
  musicVol = num(localStorage.getItem('nanming:vol:music'), 0.55);
  sfxVol = num(localStorage.getItem('nanming:vol:sfx'), 0.8);
  ambVol = num(localStorage.getItem('nanming:vol:amb'), 0.5);
} catch { /* ignore */ }

function init(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol; musicBus.connect(master);
    duckBus = ctx.createGain(); duckBus.gain.value = 1; duckBus.connect(musicBus);
    ambBus = ctx.createGain(); ambBus.gain.value = ambVol; ambBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    const ir = impulse(ctx, 3.2, 2.4);
    const mv = ctx.createConvolver(); mv.buffer = ir;
    musicSend = ctx.createGain(); musicSend.gain.value = 0.55; musicSend.connect(mv).connect(duckBus);
    const sv = ctx.createConvolver(); sv.buffer = ir;
    sfxSend = ctx.createGain(); sfxSend.gain.value = 0.55; sfxSend.connect(sv).connect(sfxBus);
    return ctx;
  } catch { ctx = null; return null; }
}
function ac(): AudioContext | null {
  const a = init();
  if (a && a.state === 'suspended') void a.resume();
  return a;
}
/** 首次用户操作时解锁声音并开始当前场景的配乐 */
export function unlockAudio() {
  const a = ac();
  if (!a) return;
  if (!timer) timer = window.setInterval(tick, 120);
  tick();
}
export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('nanming:muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.1);
}
export function getVolumes() { return { music: musicVol, sfx: sfxVol, amb: ambVol }; }
/** 三条滑杆各管一类：配乐（连同其混响）、音效（连同其混响）、环境声 */
export function setVolume(kind: 'music' | 'sfx' | 'amb', v: number) {
  v = Math.max(0, Math.min(1, v));
  if (kind === 'music') musicVol = v; else if (kind === 'sfx') sfxVol = v; else ambVol = v;
  try { localStorage.setItem('nanming:vol:' + kind, String(v)); } catch { /* ignore */ }
  if (ctx) (kind === 'music' ? musicBus : kind === 'sfx' ? sfxBus : ambBus).gain.setTargetAtTime(v, ctx.currentTime, 0.08);
}
/** 让配乐暂时收住（读到百姓蒙难时留出安静） */
export function duckMusic(sec: number, to = 0.15) {
  if (!ctx) return;
  const t = ctx.currentTime;
  duckBus.gain.cancelScheduledValues(t);
  duckBus.gain.setTargetAtTime(to, t, 0.25);
  duckBus.gain.setTargetAtTime(1, t + sec, 0.8);
}
/** 测试与调试：各总线当前增益 */
export function busLevels() { return ctx ? { master: master.gain.value, music: musicBus.gain.value, sfx: sfxBus.gain.value, amb: ambBus.gain.value } : null; }

/* ===================== 音源 ===================== */
function impulse(a: AudioContext, sec: number, decay: number): AudioBuffer {
  const len = Math.floor(a.sampleRate * sec), buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1);
  }
  return buf;
}
const noiseCache: Record<string, AudioBuffer> = {};
function noise(a: AudioContext, kind: 'white' | 'brown' | 'pink', sec = 2): AudioBuffer {
  const key = kind + sec;
  if (noiseCache[key]) return noiseCache[key];
  const len = Math.floor(a.sampleRate * sec), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.6; }
  }
  noiseCache[key] = buf;
  return buf;
}
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** 拨弦：Karplus-Strong。琴声暗而长，琵琶亮而短，筝居中。 */
const pluckCache: Record<string, AudioBuffer> = {};
function pluckBuf(a: AudioContext, midi: number, kind: 'qin' | 'pipa' | 'zheng'): AudioBuffer {
  const key = kind + midi;
  if (pluckCache[key]) return pluckCache[key];
  const sr = a.sampleRate, f = mtof(midi);
  const sec = kind === 'qin' ? 3.6 : kind === 'zheng' ? 2.6 : 1.6;
  const len = Math.floor(sr * sec), buf = a.createBuffer(1, len, sr), y = buf.getChannelData(0);
  const P = sr / f - 0.5, N = Math.floor(P), frac = P - N;
  const decay = kind === 'qin' ? 0.9985 : kind === 'zheng' ? 0.997 : 0.993;
  const bright = kind === 'qin' ? 0.25 : kind === 'zheng' ? 0.55 : 0.9;
  // 激励：琴用指肉（低通的噪声），琵琶用甲（原噪声），并带拨点位置的梳状滤波
  let lp = 0;
  for (let i = 0; i <= N + 1; i++) { const w = Math.random() * 2 - 1; lp = lp + bright * (w - lp); y[i] = lp; }
  const pick = Math.max(1, Math.floor(N * (kind === 'pipa' ? 0.12 : 0.22)));
  for (let i = N + 1; i >= pick; i--) y[i] -= y[i - pick] * 0.7;
  for (let i = N + 2; i < len; i++) {
    const a1 = y[i - N] * (1 - frac) + y[i - N - 1] * frac;
    const a2 = y[i - N - 1] * (1 - frac) + y[i - N - 2] * frac;
    y[i] = decay * 0.5 * (a1 + a2);
  }
  // 琴的胴腔：叠一点低频共鸣
  if (kind === 'qin') { let s1 = 0; for (let i = 0; i < len; i++) { s1 = s1 * 0.995 + y[i] * 0.02; y[i] = y[i] * 0.85 + s1; } }
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
  pluckCache[key] = buf;
  return buf;
}

function out(bus: GainNode, pan = 0, wet = 0.3): AudioNode {
  const a = ctx!;
  const p = a.createStereoPanner(); p.pan.value = pan;
  p.connect(bus);
  // 音效走音效混响；配乐各曲目的总线走配乐混响（都在各自的音量滑杆之后）
  if (wet > 0) { const s = a.createGain(); s.gain.value = wet; p.connect(s).connect(bus === sfxBus ? sfxSend : musicSend); }
  return p;
}

function pluck(t: number, midi: number, kind: 'qin' | 'pipa' | 'zheng', vel: number, bus: GainNode, opts: { pan?: number; orn?: Note['orn']; dur?: number } = {}) {
  const a = ctx!;
  const src = a.createBufferSource(); src.buffer = pluckBuf(a, midi, kind);
  const g = a.createGain(); g.gain.value = vel;
  // 吟猱：长音带颤；上滑：从下方滑入
  if (opts.orn === 'vib' && kind !== 'pipa') {
    const lfo = a.createOscillator(), ld = a.createGain();
    lfo.frequency.value = kind === 'qin' ? 4.5 : 5.5; ld.gain.setValueAtTime(0, t); ld.gain.linearRampToValueAtTime(kind === 'qin' ? 22 : 14, t + 0.6);
    lfo.connect(ld).connect(src.detune); lfo.start(t + 0.2); lfo.stop(t + 3.5);
  } else if (opts.orn === 'slide') { src.detune.setValueAtTime(-200, t); src.detune.exponentialRampToValueAtTime(-1, t + 0.18); }
  const end = t + Math.min(buf(src).duration, opts.dur ?? 9);
  g.gain.setValueAtTime(vel, end - 0.08); g.gain.linearRampToValueAtTime(0, end);
  src.connect(g).connect(out(bus, opts.pan ?? 0, kind === 'qin' ? 0.45 : 0.3));
  src.start(t); src.stop(end + 0.02);
  if (opts.orn === 'trem') for (let k = 1; k < 6; k++) pluck(t + k * 0.07, midi, kind, vel * 0.55, bus, { pan: opts.pan, dur: 0.3 });
}
const buf = (s: AudioBufferSourceNode) => s.buffer!;

/** 吹管：箫低沉、笛清亮，带气声与颤音 */
function wind(t: number, midi: number, dur: number, kind: 'xiao' | 'dizi', vel: number, bus: GainNode, pan = 0) {
  const a = ctx!;
  const f = mtof(midi);
  const o = a.createOscillator(), o2 = a.createOscillator();
  o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2;
  const g = a.createGain(), g2 = a.createGain(); g2.gain.value = kind === 'dizi' ? 0.22 : 0.08;
  const lfo = a.createOscillator(), ld = a.createGain(); lfo.frequency.value = 5.2; ld.gain.setValueAtTime(0, t); ld.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.6, dur * 0.5));
  lfo.connect(ld); ld.connect(o.frequency); ld.connect(o2.frequency);
  const n = a.createBufferSource(); n.buffer = noise(a, 'white'); n.loop = true;
  const nf = a.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 4;
  const ng = a.createGain(); ng.gain.value = kind === 'xiao' ? 0.12 : 0.07;
  const atk = kind === 'xiao' ? 0.18 : 0.07;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + atk); g.gain.setValueAtTime(vel, t + Math.max(atk, dur - 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  const dst = out(bus, pan, 0.5);
  o.connect(g); o2.connect(g2).connect(g); n.connect(nf).connect(ng).connect(g); g.connect(dst);
  for (const x of [o, o2, lfo, n]) { x.start(t); x.stop(t + dur + 0.15); }
}

/** 擦弦：二胡，揉弦与滑音 */
function bowed(t: number, midi: number, dur: number, vel: number, bus: GainNode, pan = 0) {
  const a = ctx!;
  const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(midi) * 0.97, t); o.frequency.exponentialRampToValueAtTime(mtof(midi), t + 0.12);
  const lfo = a.createOscillator(), ld = a.createGain(); lfo.frequency.value = 6; ld.gain.setValueAtTime(0, t); ld.gain.linearRampToValueAtTime(mtof(midi) * 0.012, t + 0.4);
  lfo.connect(ld).connect(o.frequency);
  const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 1.2;
  const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 2600;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.15); g.gain.setValueAtTime(vel, t + Math.max(0.15, dur - 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  o.connect(f1).connect(f2).connect(g).connect(out(bus, pan, 0.4));
  o.start(t); o.stop(t + dur + 0.2); lfo.start(t); lfo.stop(t + dur + 0.2);
}

/** 唢呐：尖亮的鼻音 */
function suona(t: number, midi: number, dur: number, vel: number, bus: GainNode) {
  const a = ctx!;
  const o = a.createOscillator(), o2 = a.createOscillator(); o.type = 'square'; o2.type = 'sawtooth';
  const f = mtof(midi); o.frequency.value = f; o2.frequency.value = f * 1.003;
  const lfo = a.createOscillator(), ld = a.createGain(); lfo.frequency.value = 6.5; ld.gain.value = f * 0.015; lfo.connect(ld); ld.connect(o.frequency); ld.connect(o2.frequency);
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.04); g.gain.setValueAtTime(vel, t + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(bp); o2.connect(bp); bp.connect(g).connect(out(bus, 0, 0.35));
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.1); }
}

/** 鼓：大鼓沉、堂鼓脆 */
function drum(t: number, kind: 'big' | 'tang' | 'war', vel: number, bus: GainNode, pan = 0) {
  const a = ctx!;
  const [f0, f1, len] = kind === 'big' ? [95, 42, 0.9] : kind === 'war' ? [120, 50, 0.6] : [210, 120, 0.35];
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.5);
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const dst = out(bus, pan, kind === 'tang' ? 0.15 : 0.3);
  o.connect(g).connect(dst); o.start(t); o.stop(t + len + 0.05);
  const n = a.createBufferSource(), nf = a.createBiquadFilter(), ng = a.createGain();
  n.buffer = noise(a, 'white', 1); nf.type = 'lowpass'; nf.frequency.value = kind === 'tang' ? 2400 : 900; ng.gain.setValueAtTime(vel * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n.connect(nf).connect(ng).connect(dst); n.start(t); n.stop(t + 0.15);
}
/** 梆子、木鱼：短促的木声 */
function wood(t: number, vel: number, bus: GainNode, pitch = 1, pan = 0) {
  const a = ctx!;
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 900 * pitch;
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 * pitch; bp.Q.value = 6;
  const n = a.createBufferSource(), ng = a.createGain(); n.buffer = noise(a, 'white', 1); ng.gain.setValueAtTime(vel * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  const dst = out(bus, pan, 0.2);
  o.connect(g).connect(dst); n.connect(bp).connect(ng).connect(dst);
  o.start(t); o.stop(t + 0.1); n.start(t); n.stop(t + 0.05);
}
/** 锣：大锣音调下滑，余音长 */
function gongHit(t: number, vel: number, bus: GainNode, size: 'big' | 'small' = 'big') {
  const a = ctx!;
  const base = size === 'big' ? 110 : 420;
  const dst = out(bus, 0, 0.6);
  for (const [r, gv, dec] of [[1, 1, 4.5], [1.48, 0.6, 3.2], [2.13, 0.45, 2.4], [2.79, 0.3, 1.8], [3.6, 0.22, 1.2]] as const) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(base * r * (size === 'big' ? 1.04 : 0.97), t); o.frequency.exponentialRampToValueAtTime(base * r * (size === 'big' ? 0.94 : 1.06), t + 0.8);
    const d = size === 'big' ? dec : dec * 0.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * gv * 0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dst); o.start(t); o.stop(t + d + 0.05);
  }
  const n = a.createBufferSource(), hp = a.createBiquadFilter(), ng = a.createGain();
  n.buffer = noise(a, 'white', 2); hp.type = 'bandpass'; hp.frequency.value = size === 'big' ? 1800 : 3500; hp.Q.value = 0.8;
  ng.gain.setValueAtTime(vel * 0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + (size === 'big' ? 2 : 0.6));
  n.connect(hp).connect(ng).connect(dst); n.start(t); n.stop(t + 2);
}
/** 钹：嚓 */
function cymbal(t: number, vel: number, bus: GainNode, len = 1.1) {
  const a = ctx!;
  const n = a.createBufferSource(), hp = a.createBiquadFilter(), g = a.createGain();
  n.buffer = noise(a, 'white', 2); hp.type = 'highpass'; hp.frequency.value = 4500;
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(hp).connect(g).connect(out(bus, 0, 0.4)); n.start(t); n.stop(t + len + 0.05);
}
/** 磬、钟：清越或深沉的金石之声 */
function bell(t: number, midi: number, vel: number, bus: GainNode, deep = false) {
  const a = ctx!;
  const f = mtof(midi);
  const parts = deep ? [[0.5, 1, 6], [1, 0.7, 4.5], [1.19, 0.5, 3.5], [2.0, 0.35, 2.5], [2.74, 0.2, 1.6]] : [[1, 1, 2.6], [2.76, 0.4, 1.4], [5.4, 0.2, 0.8]];
  const dst = out(bus, 0, 0.6);
  for (const [r, gv, d] of parts) {
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f * r;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * gv * 0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dst); o.start(t); o.stop(t + d + 0.05);
  }
}
/** 号角：低沉，渐强 */
function horn(t: number, midi: number, dur: number, vel: number, bus: GainNode, fall = false) {
  const a = ctx!;
  const o = a.createOscillator(); o.type = 'sawtooth';
  const f = mtof(midi); o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.25);
  if (fall) o.frequency.exponentialRampToValueAtTime(f * 0.8, t + dur);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1300, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(500, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.35); g.gain.setValueAtTime(vel, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(out(bus, 0, 0.6)); o.start(t); o.stop(t + dur + 0.05);
}
/** 一阵噪声：纸、风声、箭雨、火、碎石 */
function swish(t: number, dur: number, vel: number, bus: GainNode, f0: number, f1: number, q = 1.5, kind: 'white' | 'pink' | 'brown' = 'white', pan = 0) {
  const a = ctx!;
  const n = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
  n.buffer = noise(a, kind, 2); n.loop = true; bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(g).connect(out(bus, pan, 0.25)); n.start(t, Math.random()); n.stop(t + dur + 0.05);
}
/** 金铁相击 */
function clang(t: number, vel: number, bus: GainNode, pan = 0) {
  const a = ctx!;
  const base = 1800 + Math.random() * 900;
  const dst = out(bus, pan, 0.35);
  for (const r of [1, 1.53, 2.31, 3.17]) {
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = base * r;
    g.gain.setValueAtTime(vel / r, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 / Math.sqrt(r));
    o.connect(g).connect(dst); o.start(t); o.stop(t + 0.3);
  }
}
/** 轰：炮声、城崩 */
function boom(t: number, vel: number, bus: GainNode, len = 1.4) {
  const a = ctx!;
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + len * 0.6);
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const dst = out(bus, 0, 0.5);
  o.connect(g).connect(dst); o.start(t); o.stop(t + len);
  const n = a.createBufferSource(), lp = a.createBiquadFilter(), ng = a.createGain();
  n.buffer = noise(a, 'brown', 2); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(200, t + len);
  ng.gain.setValueAtTime(vel * 1.4, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(lp).connect(ng).connect(dst); n.start(t); n.stop(t + len);
}

/* ===================== 环境声 ===================== */
interface Amb { stop(at: number): void }
function ambience(kind: 'wind' | 'battle' | 'sea' | 'none', t: number): Amb {
  const a = ctx!;
  const nodes: AudioScheduledSourceNode[] = [];
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 2.5); g.connect(ambBus);
  const loop = (k: 'pink' | 'brown', f: number, q: number, v: number, lfoHz: number, lfoAmt: number) => {
    const n = a.createBufferSource(); n.buffer = noise(a, k, 4); n.loop = true;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const gg = a.createGain(); gg.gain.value = v;
    const lfo = a.createOscillator(), ld = a.createGain(); lfo.frequency.value = lfoHz; ld.gain.value = lfoAmt; lfo.connect(ld).connect(gg.gain);
    const lf2 = a.createOscillator(), l2 = a.createGain(); lf2.frequency.value = lfoHz * 0.7; l2.gain.value = f * 0.4; lf2.connect(l2).connect(bp.frequency);
    n.connect(bp).connect(gg).connect(g);
    n.start(t, Math.random() * 3); lfo.start(t); lf2.start(t);
    nodes.push(n, lfo, lf2);
  };
  if (kind === 'wind') { loop('pink', 500, 0.7, 0.16, 0.07, 0.09); loop('brown', 220, 0.5, 0.2, 0.05, 0.1); }
  if (kind === 'sea') { loop('pink', 400, 0.4, 0.18, 0.11, 0.16); loop('brown', 160, 0.5, 0.2, 0.08, 0.12); }
  if (kind === 'battle') { loop('pink', 700, 0.8, 0.2, 0.3, 0.12); loop('brown', 160, 0.6, 0.25, 0.17, 0.12); }
  return { stop(at: number) { g.gain.setTargetAtTime(0.0001, at, 0.8); for (const n of nodes) { try { n.stop(at + 4); } catch { /* */ } } } };
}
/** 海鸥：高而下滑的啼叫 */
function gulls(t: number, bus: GainNode) {
  const a = ctx!;
  for (let k = 0; k < 2; k++) {
    const tt = t + k * 0.32, o = a.createOscillator(), g = a.createGain(); o.type = 'triangle';
    const f = 1500 + Math.random() * 400;
    o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 0.62, tt + 0.28);
    g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.03, tt + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3);
    o.connect(g).connect(out(bus, Math.random() * 1.2 - 0.6, 0.3)); o.start(tt); o.stop(tt + 0.32);
  }
}
function birds(t: number, bus: GainNode) {
  const a = ctx!;
  const n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1600;
  for (let k = 0; k < n; k++) {
    const tt = t + k * (0.11 + Math.random() * 0.06);
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), tt + 0.06);
    g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.025, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08);
    o.connect(g).connect(out(bus, Math.random() * 1.4 - 0.7, 0.3)); o.start(tt); o.stop(tt + 0.1);
  }
}

/* ===================== 配乐：场景与调度 ===================== */
export type Scene = 'title' | 'pick' | 'map' | 'battle' | 'siege' | 'naval' | 'victory' | 'lament' | 'silent';
interface Track {
  scene: Scene; era: number; bus: GainNode; amb: Amb; ambKind: string; nextBar: number; bar: number; bpm: number;
  mel: Note[][]; key: { gong: number; mode: Mode }; lead: 'qin' | 'pipa' | 'zheng' | 'dizi'; color: string; seed: number; polity: string;
}
let track: Track | null = null;
let want: { scene: Scene; polity: string; seed: number; coast: boolean; era: number } = { scene: 'title', polity: 'ming', seed: 1, coast: false, era: 0 };
/** 离开某场景时停在第几小节：回来时从那一句接着奏，不再每次从头 */
const resumeBar: Record<string, number> = {};
let intensity = 0, targetIntensity = 0;
let timer = 0;
let scheduledNotes = 0;

/** 切换场景（标题、地图、战斗、终局）；polity 决定地图配乐的调式与主奏 */
export function setScene(scene: Scene, polity = want.polity, seed = want.seed, coast = want.coast, era = want.era) {
  if (want.scene === scene && want.polity === polity && want.coast === coast && want.era === era && track?.scene === scene) return;
  want = { scene, polity, seed, coast, era };
  if (ctx) tick();
}
/** 局势紧张度（0—1），地图配乐据此加层、换调、提速；战斗中按回合推进 */
export function setIntensity(v: number) { targetIntensity = Math.max(0, Math.min(1, v)); }
export function audioState() { return { era: track?.era ?? 0, bpm: track?.bpm ?? 0, running: ctx?.state === 'running', scene: track?.scene ?? 'none', want: want.scene, intensity: Math.round(intensity * 100) / 100, scheduled: scheduledNotes, muted, amb: track?.ambKind ?? 'none', bar: track?.bar ?? 0, levels: busLevels(), sfxActive: activeSfx }; }

function startTrack(scene: Scene, t: number): Track {
  const a = ctx!;
  const bus = a.createGain(); bus.gain.setValueAtTime(0.0001, t); bus.gain.exponentialRampToValueAtTime(1, t + 2); bus.connect(duckBus);
  const pal = paletteOf(want.polity);
  let key = { gong: pal.gong, mode: pal.mode }, lead = pal.lead, bpm = 78, color: string = pal.color;
  // 地图配乐随年代换曲：前期舒缓，越往后越急
  const era = scene === 'map' ? Math.max(0, Math.min(MAP_ERAS.length - 1, want.era)) : 0;
  let busy = 0.45;
  if (scene === 'map') { const E = MAP_ERAS[era]; bpm = E.bpm; busy = E.busy; if (E.mode) key = { gong: pal.gong + (era === 3 ? -2 : 0), mode: E.mode }; if (E.lead && !(pal.lead === 'dizi' && era < 2)) lead = E.lead; }
  if (scene === 'title') { key = { gong: 48, mode: 'yu' }; lead = 'qin'; bpm = 72; color = 'literati'; }
  if (scene === 'pick') { key = { gong: 50, mode: 'shang' }; lead = 'pipa'; bpm = 100; color = 'folk'; }
  if (scene === 'battle') { key = { gong: pal.gong, mode: 'shang' }; lead = 'pipa'; bpm = 138; }
  if (scene === 'siege') { key = { gong: pal.gong - 2, mode: 'yu' }; lead = 'pipa'; bpm = 104; }
  if (scene === 'naval') { key = { gong: pal.gong, mode: 'zhi' }; lead = 'dizi'; bpm = 116; color = 'sea'; }
  if (scene === 'victory') { key = { gong: 55, mode: 'gong' }; lead = 'zheng'; bpm = 96; }
  if (scene === 'lament') { key = { gong: 50, mode: 'yu' }; lead = 'qin'; bpm = 50; }
  const lo = lead === 'qin' ? key.gong + 2 : lead === 'dizi' ? key.gong + 14 : key.gong + 9;
  const sc = scale(key.gong, key.mode, lo, lo + 17);
  const seed = want.seed * 7 + scene.length * 131 + key.gong + era * 1013;
  const war = scene === 'battle' || scene === 'siege' || scene === 'naval';
  const mel = melody(seed, sc, war ? 2 : 4, { rest: scene === 'title' || scene === 'lament' ? 0.15 : war ? 0.03 : 0.1 - era * 0.02, busy: war || scene === 'pick' ? 0.9 : busy });
  // 沿海势力（郑氏等）在地图上听得到海浪与海鸥，内陆是风声
  const coast = scene === 'map' && want.coast;
  const ambKind = scene === 'battle' || scene === 'siege' ? 'battle' : scene === 'silent' ? 'none' : color === 'sea' || coast ? 'sea' : 'wind';
  if (coast) color = 'coast';
  // 从离开时的乐句起头接着奏（取整到一句的开头）
  const sectionBars = Math.max(1, beatsOf(mel[0]) / 4);
  const rk = resumeKey(scene);
  const bar0 = rk && resumeBar[rk] ? Math.floor(resumeBar[rk] / sectionBars) * sectionBars : 0;
  return { scene, era, bus, amb: ambience(ambKind as 'wind' | 'battle' | 'sea' | 'none', t), ambKind, nextBar: t + 0.4, bar: bar0, bpm, mel, key, lead, color, seed, polity: want.polity };
}
const resumeKey = (scene: Scene) => (scene === 'map' ? 'map:' + want.polity + ':' + want.coast + ':' + want.era : scene === 'title' ? 'title' : '');
function tick() {
  const a = ctx;
  if (!a || a.state !== 'running') return;
  intensity += (targetIntensity - intensity) * 0.08;
  const now = a.currentTime;
  if (!track || track.scene !== want.scene || (track.scene === 'map' && (track.polity !== want.polity || (track.color === 'coast') !== want.coast || track.era !== want.era))) {
    if (track) {
      const old = track;
      if (old.scene === 'map') resumeBar['map:' + old.polity + ':' + (old.ambKind === 'sea' && old.color === 'coast') + ':' + old.era] = old.bar;
      if (old.scene === 'title') resumeBar.title = old.bar;
      old.bus.gain.setTargetAtTime(0.0001, now, 0.6); old.amb.stop(now); setTimeout(() => old.bus.disconnect(), 5000);
    }
    track = want.scene === 'silent' ? null : startTrack(want.scene, now + 0.05);
    if (!track) return;
  }
  const tr = track;
  const barDur = () => 4 * 60 / (tr.bpm + (tr.scene === 'map' ? intensity * 24 : tr.scene === 'battle' || tr.scene === 'siege' || tr.scene === 'naval' ? intensity * 24 : 0));
  while (tr.nextBar < now + barDur() * 1.2) {
    scheduleBar(tr, tr.nextBar, barDur());
    tr.nextBar += barDur();
    tr.bar++;
  }
}

/** 排一小节 */
function scheduleBar(tr: Track, t0: number, dur: number) {
  const beat = dur / 4;
  const bus = tr.bus;
  const war = tr.scene === 'battle' || tr.scene === 'siege' || tr.scene === 'naval';
  const I = war ? 0.55 + intensity * 0.45 : intensity;
  const rng = makeRng(tr.seed + tr.bar * 977);
  // 主旋律：四句一轮；每句 bars 小节
  const sectionBars = beatsOf(tr.mel[0]) / 4;
  const phraseIdx = Math.floor(tr.bar / sectionBars) % tr.mel.length;
  const inPhrase = tr.bar % sectionBars;
  // 紧张时调式转羽、主奏移低八度一点
  const dark = tr.scene === 'map' && I > 0.6;
  const shift = dark ? -3 : 0;
  // 留白：标题与悲歌每四句后歇两小节
  const resting = (tr.scene === 'title' || tr.scene === 'lament') && Math.floor(tr.bar / sectionBars) % 5 === 4;
  if (!resting) {
    let t = 0;
    for (const n of tr.mel[phraseIdx]) {
      const start = t, end = t + n.beats;
      t = end;
      if (end <= inPhrase * 4 || start >= (inPhrase + 1) * 4) continue;
      if (start < inPhrase * 4) continue; // 跨小节的长音已在前一小节起奏
      if (n.midi === null) continue;
      const when = t0 + (start - inPhrase * 4) * beat;
      const m = n.midi + shift;
      const len = n.beats * beat;
      if (tr.lead === 'dizi') wind(when, m, len * 0.95, 'dizi', 0.18, bus, -0.15);
      else pluck(when, m, tr.lead, (n.accent ? 0.42 : 0.32) * (tr.lead === 'pipa' ? 0.8 : 1), bus, { pan: -0.15, orn: (war || tr.scene === 'pick') && n.beats >= 1 ? 'trem' : n.orn, dur: len + 1.5 });
      scheduledNotes++;
      // 琴的“散音”：长音下加低八度空弦
      if (tr.lead === 'qin' && n.beats >= 2 && rng.next() < 0.5) pluck(when + 0.02, m - 12, 'qin', 0.18, bus, { pan: 0.1 });
    }
  }
  const sc = scale(tr.key.gong, tr.key.mode, tr.key.gong - 12, tr.key.gong + 12);
  const root = sc.notes[sc.tonics[0] ?? 0] + shift;
  switch (tr.scene) {
    case 'title':
    case 'lament': {
      // 箫：每两小节一个长音，与琴相和
      if (tr.bar % 2 === 1 && tr.bar > 3) wind(t0 + beat * 0.5, root + 12 + (rng.next() < 0.5 ? 7 : 0), beat * 6, 'xiao', 0.09, bus, 0.25);
      if (tr.bar % 8 === 0) bell(t0, root + 24, 0.18, bus);
      if (tr.scene === 'lament' && tr.bar % 4 === 2) bowed(t0, root + 12, beat * 4, 0.05, bus, 0.3);
      if (tr.scene === 'title') {
        // 远处战鼓与号角：山雨欲来
        drum(t0, 'big', 0.3, bus); drum(t0 + beat * 2.5, 'big', 0.18, bus); drum(t0 + beat * 3, 'big', 0.22, bus);
        if (tr.bar % 2 === 1) for (let k = 0; k < 4; k++) drum(t0 + beat * 3 + k * beat / 4, 'tang', 0.05 + k * 0.025, bus, 0.2);
        bowed(t0, root - 12, dur * 0.98, 0.035, bus, -0.2);
        if (tr.bar % 8 === 4) horn(t0, root - 5, beat * 3.5, 0.08, bus);
        if (tr.bar % 16 === 0 && tr.bar) gongHit(t0, 0.22, bus);
      }
      break;
    }
    case 'pick': {
      // 群雄并起：琵琶轮指、堂鼓连击、唢呐一声
      drum(t0, 'big', 0.38, bus); drum(t0 + beat * 2, 'big', 0.3, bus);
      for (let k = 0; k < 8; k++) if (k % 2) drum(t0 + k * beat / 2, 'tang', 0.12, bus, k % 4 === 1 ? -0.25 : 0.25);
      if (tr.bar % 4 === 3) for (let k = 0; k < 4; k++) drum(t0 + beat * 3 + k * beat / 4, 'war', 0.12 + k * 0.03, bus);
      if (tr.bar % 4 === 0) { cymbal(t0, 0.06, bus); bowed(t0, root, beat * 4, 0.05, bus, 0.25); }
      if (tr.bar % 8 === 6) suona(t0 + beat, root + 24, beat * 2.5, 0.05, bus);
      break;
    }
    case 'siege': {
      // 攻守城：沉重的大鼓、低号、锣声，节奏缓而压迫
      drum(t0, 'big', 0.6, bus); drum(t0 + beat * 1.5, 'big', 0.4, bus); drum(t0 + beat * 2, 'big', 0.5, bus);
      for (let k = 0; k < 4; k++) drum(t0 + k * beat + beat / 2, 'war', 0.12, bus, 0.3);
      bowed(t0, root - 12, dur, 0.06, bus, -0.2); bowed(t0, root - 5, dur, 0.035, bus, 0.2);
      if (tr.bar % 2 === 0) gongHit(t0 + beat * 3, 0.14, bus, 'big');
      if (tr.bar % 4 === 1) horn(t0, root - 7, beat * 3, 0.1, bus);
      if (tr.bar % 4 === 3) for (let k = 0; k < 8; k++) drum(t0 + beat * 2 + k * beat / 4, 'tang', 0.06 + k * 0.02, bus);
      break;
    }
    case 'naval': {
      // 水战：浪里的鼓点与唢呐，笛声穿过
      drum(t0, 'big', 0.45, bus); drum(t0 + beat * 2.5, 'big', 0.35, bus);
      for (let k = 0; k < 8; k++) if (k % 2) drum(t0 + k * beat / 2, 'war', 0.13, bus, k % 4 === 1 ? -0.3 : 0.3);
      if (tr.bar % 4 === 0) { gongHit(t0, 0.12, bus, 'small'); cymbal(t0, 0.06, bus); }
      if (tr.bar % 4 === 2) suona(t0 + beat, root + 19, beat * 2.5, 0.05, bus);
      if (tr.bar % 8 === 0) horn(t0, root - 5, beat * 3, 0.08, bus);
      bowed(t0, root - 12, dur, 0.04, bus, 0.2);
      break;
    }
    case 'map': {
      // 底：低音拨弦按拍子走根音与五度
      if (tr.bar % 2 === 0) pluck(t0, root - 12 + (dark ? 0 : 0), tr.lead === 'pipa' ? 'pipa' : 'zheng', 0.16, bus, { pan: 0.2 });
      if (tr.bar % 2 === 1) pluck(t0 + beat * 2, root - 5, 'zheng', 0.12, bus, { pan: 0.2 });
      // 箫或二胡：和声长音
      if (tr.bar % 4 === 2) (tr.color === 'folk' ? bowed : (t: number, m: number, d: number, v: number, b: GainNode, p: number) => wind(t, m, d, 'xiao', v * 1.4, b, p))(t0, root + 7, beat * 7, 0.06, bus, 0.3);
      // 底鼓：乱世不止，平时也有隐约的鼓点
      drum(t0, 'tang', 0.07 + I * 0.08, bus, -0.3); drum(t0 + beat * 2, 'tang', 0.05 + I * 0.06, bus, -0.3);
      if (tr.bar % 2 === 1) drum(t0 + beat * 3.5, 'war', 0.05, bus, 0.3);
      // 梆子计时：太平时轻敲
      if (I < 0.3 && tr.bar % 4 === 3) wood(t0 + beat * 3, 0.05, bus, 1, 0.4);
      // 鸟鸣：太平之世
      if (I < 0.25 && rng.next() < 0.18) birds(t0 + rng.next() * dur, bus);
      // 年代越后，伴奏越密：丙戌以后添堂鼓切分，庚寅以后添大鼓与低胡，乙未以后八分音符鼓点与号角
      const E = tr.era;
      if (E >= 1) { drum(t0 + beat * 1.5, 'tang', 0.07, bus, 0.3); drum(t0 + beat * 3.5, 'tang', 0.06, bus, 0.3); }
      if (E >= 2) { drum(t0, 'big', 0.16, bus); if (tr.bar % 2 === 0) bowed(t0, root - 12, dur * 0.95, 0.035, bus, -0.2); if (tr.bar % 4 === 3) cymbal(t0 + beat * 3, 0.04, bus, 0.8); }
      if (E >= 3) { for (let k = 0; k < 8; k++) if (k % 2) drum(t0 + k * beat / 2, 'war', 0.07, bus, k % 4 === 1 ? -0.25 : 0.25); if (tr.bar % 8 === 4) horn(t0 + beat, root - 5, beat * 2.5, 0.05, bus); }
      // 紧张：堂鼓心跳
      if (I > 0.3) { drum(t0, 'tang', 0.18 * I, bus, -0.3); if (I > 0.45) drum(t0 + beat * 2, 'tang', 0.14 * I, bus, -0.3); }
      // 更紧：大鼓、低音二胡、偶有号角
      if (I > 0.6) { drum(t0, 'big', 0.25 * I, bus); bowed(t0, root - 12, dur * 0.95, 0.04 * I, bus, -0.2); }
      if (I > 0.8 && tr.bar % 8 === 0) horn(t0 + beat, root - 5, beat * 3, 0.06, bus);
      // 清军：马蹄般的鼓点；郑氏：海浪里的锣
      if (tr.color === 'coast' && rng.next() < 0.22) gulls(t0 + rng.next() * dur, bus);
      if (tr.color === 'coast' && tr.bar % 8 === 5) gongHit(t0 + beat * 2, 0.06, bus, 'small');
      if (tr.color === 'steppe' && tr.bar % 2 === 0) { drum(t0 + beat * 1.5, 'tang', 0.07, bus, 0.3); drum(t0 + beat * 1.75, 'tang', 0.05, bus, 0.3); }
      if (tr.bar % 16 === 15) gongHit(t0 + beat * 3, 0.12, bus, 'small');
      break;
    }
    case 'battle': {
      // 战鼓：大鼓一三拍，堂鼓八分音符，小节末滚奏
      drum(t0, 'big', 0.55, bus); drum(t0 + beat * 2, 'big', 0.45, bus);
      for (let k = 0; k < 8; k++) if (k % 2 === 1 || I > 0.75) drum(t0 + k * beat / 2, 'war', 0.16 + (k % 2 ? 0 : 0.06), bus, k % 2 ? 0.25 : -0.25);
      if (tr.bar % 4 === 3) for (let k = 0; k < 6; k++) drum(t0 + beat * 3 + k * beat / 6, 'tang', 0.08 + k * 0.03, bus, 0.1);
      if (tr.bar % 4 === 0) cymbal(t0, 0.07, bus, 0.9);
      if (tr.bar % 8 === 0) horn(t0, root - 5, beat * 3.5, 0.09, bus);
      if (tr.bar % 8 === 4 && I > 0.7) suona(t0 + beat, root + 19, beat * 2.5, 0.05, bus);
      if (tr.bar % 4 === 0 && tr.bar) gongHit(t0, 0.18, bus, 'small');
      bowed(t0, root - 12, dur, 0.05, bus, 0.2);
      break;
    }
    case 'victory': {
      drum(t0, 'big', 0.45, bus); drum(t0 + beat * 2, 'big', 0.35, bus);
      for (let k = 0; k < 4; k++) drum(t0 + k * beat, 'tang', 0.12, bus, 0.2);
      if (tr.bar % 2 === 0) cymbal(t0, 0.06, bus);
      if (tr.bar % 4 === 0) suona(t0 + beat, root + 24, beat * 2, 0.05, bus);
      if (tr.bar % 4 === 2) suona(t0, root + 28, beat * 3, 0.05, bus);
      break;
    }
  }
}

/* ===================== 音效 ===================== */
/** 同时发声的音效数：混战时限流，免得糊成一片 */
let activeSfx = 0;
const recent: Record<string, number> = {};
function fx(key?: string, max = 3, windowMs = 260): { a: AudioContext; t: number } | null {
  const a = ac(); if (!a || a.state !== 'running') return null;
  if (key) {
    const now = performance.now(), k0 = key + ':' + Math.floor(now / windowMs);
    recent[k0] = (recent[k0] ?? 0) + 1;
    if (recent[k0] > max) return null;
    for (const k of Object.keys(recent)) if (!k.endsWith(':' + Math.floor(now / windowMs))) delete recent[k];
  }
  activeSfx++; setTimeout(() => activeSfx--, 1200);
  return { a, t: a.currentTime + 0.01 };
}

/** 普通月报：磬 */
export function chime() { const f = fx(); if (!f) return; bell(f.t, 84, 0.35, sfxBus); bell(f.t + 0.25, 91, 0.2, sfxBus); }
/** 紧急军报：三通鼓 */
export function alarm() { const f = fx(); if (!f) return; drum(f.t, 'big', 0.6, sfxBus); drum(f.t + 0.25, 'big', 0.6, sfxBus); drum(f.t + 0.5, 'big', 0.75, sfxBus); gongHit(f.t + 0.75, 0.3, sfxBus, 'small'); }
/** 战斗回合：一声鼓 */
export function beat() { const f = fx(); if (!f) return; drum(f.t, 'big', 0.5, sfxBus); }
/** 胜负：锣与号 */
export function gong(win: boolean) {
  const f = fx(); if (!f) return;
  if (win) { gongHit(f.t, 0.6, sfxBus); for (let k = 0; k < 4; k++) drum(f.t + k * 0.16, 'war', 0.35, sfxBus); suona(f.t + 0.7, 79, 1.2, 0.08, sfxBus); cymbal(f.t + 0.7, 0.15, sfxBus, 1.6); }
  else { gongHit(f.t, 0.45, sfxBus); horn(f.t + 0.3, 43, 2.4, 0.12, sfxBus, true); }
}
/** 按钮：木声轻叩 */
export function click() { const f = fx(); if (!f) return; wood(f.t, 0.12, sfxBus, 1.3); }
/** 悬停：轻拨一弦（不同势力不同音） */
export function hoverPluck(i: number) { const f = fx(); if (!f) return; const sc = scale(50, 'gong', 62, 86); pluck(f.t, sc.notes[(i * 2) % sc.notes.length], 'zheng', 0.22, sfxBus, { dur: 1.6 }); }
/** 翻开面板：纸声 */
export function paper() { const f = fx(); if (!f) return; swish(f.t, 0.22, 0.12, sfxBus, 2500, 5000, 0.8); }
/** 展开弹窗：卷轴 */
export function scroll() { const f = fx(); if (!f) return; swish(f.t, 0.35, 0.1, sfxBus, 800, 3500, 0.7); wood(f.t + 0.3, 0.08, sfxBus, 0.6); }
/** 落印 */
export function stampSfx() { const f = fx(); if (!f) return; drum(f.t, 'tang', 0.25, sfxBus); wood(f.t, 0.15, sfxBus, 0.5); swish(f.t, 0.12, 0.06, sfxBus, 3000, 1500, 1); }
/** 下令的附带声：募兵脚步、粮车、行军号、出使铃 */
export function orderSfx(kind: string) {
  const f = fx(); if (!f) return;
  if (kind === 'recruit') for (let k = 0; k < 6; k++) drum(f.t + 0.15 + k * 0.17, 'tang', 0.06, sfxBus, k % 2 ? 0.3 : -0.3);
  else if (kind === 'transfer') for (let k = 0; k < 5; k++) wood(f.t + 0.15 + k * 0.21, 0.07, sfxBus, 0.45 + (k % 2) * 0.08, 0.2);
  else if (kind === 'army' || kind === 'command') horn(f.t + 0.1, 45, 1.1, 0.1, sfxBus);
  else if (kind === 'envoy' || kind === 'persuade') bell(f.t + 0.1, 93, 0.15, sfxBus);
  else if (kind === 'policy' || kind === 'appoint') pluck(f.t + 0.1, 74, 'qin', 0.3, sfxBus);
}
/** 结束本月：一声大鼓 */
export function endTurnSfx() { const f = fx(); if (!f) return; drum(f.t, 'big', 0.7, sfxBus); drum(f.t + 0.35, 'big', 0.5, sfxBus); }
/** 翻月：纸页 + 钟 */
export function monthSfx(newYear: boolean) { const f = fx(); if (!f) return; swish(f.t, 0.3, 0.14, sfxBus, 1500, 4500, 0.8); bell(f.t + 0.45, newYear ? 45 : 57, newYear ? 0.6 : 0.4, sfxBus, true); }
/** 地图上易主：得城亮锣，失城沉锣 */
export function captureSfx(gain: boolean) { const f = fx(); if (!f) return; if (gain) { gongHit(f.t, 0.35, sfxBus, 'small'); cymbal(f.t, 0.08, sfxBus); } else { gongHit(f.t, 0.45, sfxBus); horn(f.t + 0.2, 41, 1.6, 0.08, sfxBus, true); } }
/** 地图上远处交战 */
export function distantBattle() { const f = fx(); if (!f) return; for (let k = 0; k < 3; k++) drum(f.t + k * 0.12, 'war', 0.12, sfxBus, (Math.random() - 0.5)); clang(f.t + 0.3, 0.03, sfxBus); }
/** 抉择：琴的和弦 + 鼓 */
export function choiceSfx() { const f = fx(); if (!f) return; drum(f.t, 'big', 0.4, sfxBus); for (const [k, m] of [62, 69, 74].entries()) pluck(f.t + 0.1 + k * 0.05, m, 'qin', 0.3, sfxBus); }
/** 完成一步 */
export function successSfx() { const f = fx(); if (!f) return; for (const [k, m] of [74, 76, 79, 81, 86].entries()) pluck(f.t + k * 0.07, m, 'zheng', 0.28, sfxBus, { dur: 1.4 }); }
/** 不可行 */
export function denySfx() { const f = fx(); if (!f) return; wood(f.t, 0.12, sfxBus, 0.35); wood(f.t + 0.1, 0.1, sfxBus, 0.3); }
/** 开局：大锣一声，琴起一句 */
export function introSfx() { const f = fx(); if (!f) return; gongHit(f.t, 0.55, sfxBus); for (const [k, m] of [50, 57, 62, 64, 69].entries()) pluck(f.t + 0.9 + k * 0.22, m, 'qin', 0.35, sfxBus); }

/* ---- 史事：按基调配声 ---- */
export type Tone = 'lament' | 'death' | 'edict' | 'turn' | 'war' | 'court' | 'omen';
export function eventSfx(tone: Tone = 'omen') {
  const f = fx('ev', 1, 600); if (!f) return;
  const t = f.t;
  switch (tone) {
    case 'lament': // 丧乱：一声深钟，二胡低回下行，配乐收住
      bell(t, 41, 0.5, sfxBus, true); bowed(t + 0.5, 62, 1.6, 0.07, sfxBus, -0.2); bowed(t + 2.0, 57, 2.2, 0.06, sfxBus, -0.2);
      duckMusic(6, 0.12); break;
    case 'death': // 薨逝：三响丧钟，渐弱
      for (let k = 0; k < 3; k++) bell(t + k * 0.95, 43, 0.5 - k * 0.12, sfxBus, true);
      duckMusic(3.5, 0.3); break;
    case 'edict': // 诏令：小锣一声、落印、木声
      gongHit(t, 0.25, sfxBus, 'small'); drum(t + 0.35, 'tang', 0.25, sfxBus); wood(t + 0.36, 0.15, sfxBus, 0.5); swish(t + 0.3, 0.14, 0.07, sfxBus, 3000, 1500, 1); break;
    case 'turn': // 易帜：号角上扬、钹
      horn(t, 50, 1.0, 0.11, sfxBus); horn(t + 0.7, 55, 1.2, 0.1, sfxBus); cymbal(t + 0.7, 0.1, sfxBus, 1.2); break;
    case 'war': // 兵事：战鼓三通、号
      for (let k = 0; k < 6; k++) drum(t + k * 0.13, k % 3 === 2 ? 'big' : 'war', 0.3 + (k % 3) * 0.1, sfxBus, k % 2 ? 0.25 : -0.25);
      horn(t + 0.8, 45, 1.3, 0.1, sfxBus); break;
    case 'court': // 朝局：磬三击、琴和弦
      for (const [k, m] of [79, 84, 91].entries()) bell(t + k * 0.22, m, 0.28, sfxBus);
      for (const [k, m] of [62, 69, 74].entries()) pluck(t + 0.7 + k * 0.06, m, 'qin', 0.28, sfxBus); break;
    default: // 征兆、线索：箫一声、轻磬
      wind(t, 69, 1.6, 'xiao', 0.12, sfxBus, 0.2); bell(t + 0.9, 88, 0.16, sfxBus);
  }
}

/** 军报播放：一条一声，依事件原因与我方关系而异（见 newsFx.ts） */
export function newsSfx(kind: string) {
  if (kind.startsWith('ev:')) { eventSfx(kind.slice(3) as Tone); return; }
  if (kind === 'resultOk' || kind === 'resultFail') { resultSfx(kind === 'resultOk'); return; }
  const f = fx('news', 1, 500); if (!f) return;
  const t = f.t;
  switch (kind) {
    case 'breachGain': gongHit(t, 0.35, sfxBus, 'small'); cymbal(t, 0.09, sfxBus); for (let k = 0; k < 4; k++) drum(t + 0.15 + k * 0.12, 'war', 0.25, sfxBus); break;
    case 'breachLoss': gongHit(t, 0.45, sfxBus); horn(t + 0.2, 41, 1.6, 0.08, sfxBus, true); break;
    case 'breachFar': boom(t, 0.25, sfxBus, 1.2); drum(t + 0.3, 'big', 0.18, sfxBus); break;
    case 'handGain': drum(t, 'tang', 0.25, sfxBus); wood(t, 0.15, sfxBus, 0.5); for (const [k, m] of [74, 79, 81].entries()) pluck(t + 0.2 + k * 0.08, m, 'zheng', 0.26, sfxBus, { dur: 1.4 }); break;
    case 'handLoss': drum(t, 'tang', 0.22, sfxBus); bell(t + 0.15, 50, 0.3, sfxBus, true); break;
    case 'handFar': drum(t, 'tang', 0.18, sfxBus); wood(t, 0.1, sfxBus, 0.5); break;
    case 'battleNear': for (let k = 0; k < 4; k++) drum(t + k * 0.12, 'war', 0.22, sfxBus, (k % 2) - 0.5); for (let k = 0; k < 4; k++) clang(t + 0.4 + Math.random() * 0.4, 0.05, sfxBus, Math.random() - 0.5); break;
    case 'battleFar': for (let k = 0; k < 3; k++) drum(t + k * 0.12, 'war', 0.11, sfxBus, (Math.random() - 0.5)); clang(t + 0.3, 0.025, sfxBus); break;
    case 'siege': drum(t, 'big', 0.35, sfxBus); drum(t + 0.45, 'big', 0.3, sfxBus); horn(t + 0.2, 43, 1.2, 0.07, sfxBus); break;
    case 'lift': horn(t, 52, 1.1, 0.09, sfxBus); bell(t + 0.6, 81, 0.18, sfxBus); break;
    case 'retreat': horn(t, 47, 1.2, 0.08, sfxBus, true); break;
    case 'march': for (let k = 0; k < 6; k++) drum(t + k * 0.18, 'tang', 0.05 + (k % 2) * 0.02, sfxBus, k % 2 ? 0.3 : -0.3); break;
    case 'urgent': drum(t, 'big', 0.5, sfxBus); drum(t + 0.25, 'big', 0.5, sfxBus); gongHit(t + 0.5, 0.25, sfxBus, 'small'); break;
    case 'envoy': bell(t, 93, 0.16, sfxBus); bell(t + 0.3, 88, 0.12, sfxBus); break;
    case 'people': pluck(t, 69, 'qin', 0.3, sfxBus); pluck(t + 0.18, 74, 'qin', 0.25, sfxBus); break;
    case 'policy': wood(t, 0.12, sfxBus, 0.6); pluck(t + 0.1, 74, 'zheng', 0.24, sfxBus); break;
    default: bell(t, 84, 0.35, sfxBus); bell(t + 0.25, 91, 0.2, sfxBus);
  }
}

/** 号令结算的结果：成则清亮，败则沉闷 */
export function resultSfx(ok: boolean) {
  const f = fx('res', 2, 300); if (!f) return;
  if (ok) for (const [k, m] of [74, 79, 86].entries()) pluck(f.t + k * 0.08, m, 'zheng', 0.26, sfxBus, { dur: 1.2 });
  else { wood(f.t, 0.12, sfxBus, 0.35); pluck(f.t + 0.1, 57, 'qin', 0.25, sfxBus); }
}
/** 地图上行军：脚步与马蹄 */
export function marchSfx(cav = false) {
  const f = fx('march', 1, 800); if (!f) return;
  if (cav) for (let k = 0; k < 10; k++) drum(f.t + k * 0.09 + Math.random() * 0.03, 'tang', 0.05, sfxBus, Math.random() - 0.5);
  else for (let k = 0; k < 6; k++) drum(f.t + k * 0.2, 'tang', 0.06, sfxBus, k % 2 ? 0.3 : -0.3);
  horn(f.t + 0.1, 45, 0.9, 0.06, sfxBus);
}

/* ---- 战斗场景 ---- */
export const battleSfx = {
  advance(cav: boolean) { const f = fx(); if (!f) return; if (cav) for (let k = 0; k < 14; k++) drum(f.t + k * 0.06 + Math.random() * 0.03, 'tang', 0.05 + Math.random() * 0.04, sfxBus, Math.random() - 0.5); else for (let k = 0; k < 4; k++) drum(f.t + k * 0.2, 'war', 0.12, sfxBus); },
  shout() { const f = fx(); if (!f) return; swish(f.t, 1.1, 0.22, sfxBus, 500, 900, 2.5, 'pink'); swish(f.t + 0.1, 1.0, 0.16, sfxBus, 800, 1300, 3, 'pink'); },
  arrows() { const f = fx('arrows', 2); if (!f) return; for (let k = 0; k < 5; k++) swish(f.t + k * 0.05, 0.4, 0.09, sfxBus, 6000, 2500, 3, 'white', Math.random() - 0.5); },
  muskets() { const f = fx('musket', 2); if (!f) return; for (let k = 0; k < 8; k++) { const t = f.t + Math.random() * 0.35; swish(t, 0.12, 0.25, sfxBus, 1800, 400, 0.8, 'white', Math.random() - 0.5); } },
  cannon() { const f = fx('cannon', 2); if (!f) return; boom(f.t, 0.7, sfxBus); },
  /** 舷炮：一舷火炮次第轰鸣，比火铳沉、比攻城炮短 */
  broadside() { const f = fx('broadside', 2); if (!f) return; for (let k = 0; k < 4; k++) { boom(f.t + k * 0.14 + Math.random() * 0.05, 0.42, sfxBus, 0.9); swish(f.t + k * 0.14, 0.12, 0.12, sfxBus, 2200, 600, 0.8, 'white', k % 2 ? 0.3 : -0.3); } },
  impact() { const f = fx(); if (!f) return; boom(f.t, 0.35, sfxBus, 0.6); swish(f.t, 0.5, 0.15, sfxBus, 1500, 300, 0.8, 'brown'); },
  clash(n = 6) { const f = fx('clash', 2); if (!f) return; for (let k = 0; k < n; k++) clang(f.t + Math.random() * 0.6, 0.05 + Math.random() * 0.05, sfxBus, Math.random() * 1.6 - 0.8); },
  fire() { const f = fx('fire', 1, 500); if (!f) return; swish(f.t, 1.6, 0.25, sfxBus, 600, 2400, 0.6, 'pink'); for (let k = 0; k < 10; k++) wood(f.t + Math.random() * 1.4, 0.04, sfxBus, 2 + Math.random(), Math.random() - 0.5); },
  ambush() { const f = fx(); if (!f) return; for (let k = 0; k < 5; k++) drum(f.t + k * 0.1, 'big', 0.4, sfxBus); battleSfx.shout(); },
  night() { const f = fx(); if (!f) return; wood(f.t, 0.1, sfxBus, 0.6); wood(f.t + 0.5, 0.1, sfxBus, 0.6); swish(f.t, 1.5, 0.06, sfxBus, 300, 500, 1, 'pink'); },
  persuade() { const f = fx(); if (!f) return; horn(f.t, 50, 1.5, 0.1, sfxBus); },
  rout() { const f = fx(); if (!f) return; horn(f.t, 47, 1.8, 0.12, sfxBus, true); },
  rubble() { const f = fx(); if (!f) return; swish(f.t, 0.9, 0.3, sfxBus, 900, 150, 0.7, 'brown'); },
  breach() { const f = fx(); if (!f) return; boom(f.t, 0.9, sfxBus, 2.2); gongHit(f.t + 0.4, 0.5, sfxBus); battleSfx.shout(); },
  ladders() { const f = fx(); if (!f) return; for (let k = 0; k < 4; k++) wood(f.t + 0.2 + k * 0.18, 0.12, sfxBus, 0.4); },
};

// 首次用户操作时解锁
if (typeof window !== 'undefined') {
  const go = () => { unlockAudio(); };
  window.addEventListener('pointerdown', go, { capture: true });
  window.addEventListener('keydown', go, { capture: true });
}
