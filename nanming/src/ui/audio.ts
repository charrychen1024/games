/* 声音：全部由 WebAudio 实时合成。普通月报一声磬，紧急军报三通鼓。 */
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('nanming:muted') === '1'; } catch { /* ignore */ }

function ac(): AudioContext | null {
  if (muted) return null;
  try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); return ctx; } catch { return null; }
}
export function isMuted() { return muted; }
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem('nanming:muted', m ? '1' : '0'); } catch { /* ignore */ } }

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, decay = true) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
  void decay;
}
function drum(when: number, gain = 0.5) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.45);
  const len = Math.floor(a.sampleRate * 0.12), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = a.createBufferSource(), ng = a.createGain(), f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900; n.buffer = buf; ng.gain.value = gain * 0.4;
  n.connect(f).connect(ng).connect(a.destination); n.start(t);
}
/** 普通月报：磬 */
export function chime() { tone(1318, 1.4, 'sine', 0.12); tone(1976, 0.9, 'sine', 0.05, 0.01); tone(659, 1.6, 'triangle', 0.05); }
/** 紧急军报：三通鼓 */
export function alarm() { drum(0); drum(0.22); drum(0.44, 0.65); }
/** 战斗回合：一声鼓 */
export function beat() { drum(0, 0.35); }
/** 胜负：锣 */
export function gong(win: boolean) {
  const base = win ? 196 : 147;
  tone(base, 2.2, 'sawtooth', 0.04); tone(base * 2.01, 1.8, 'sine', 0.08); tone(base * 2.76, 1.4, 'sine', 0.04);
}
export function click() { tone(880, 0.08, 'square', 0.02); }
