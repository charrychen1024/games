/* 野战是否“未战先决”：从真实对局中取野战、水战，按画面里的走法模拟（敌方每两秒由电脑指挥，我方不动或由电脑代打），
 * 统计开战多少秒结束、双方折损。npx tsx tools/field-audit.ts */
import { createGame } from '../src/data/scenario1644';
import { resolveMonth } from '../src/core/turn';
import { autoResolve } from '../src/core/battle';
import { createField, stepField, aiField } from '../src/core/field';
import { createSiege, stepSiege, aiCommands } from '../src/core/siege';
import type { BattleState } from '../src/core/types';
const found: { b: BattleState; side: 'att' | 'def' }[] = [];
const sieges: { b: BattleState; side: 'att' | 'def' }[] = [];
for (const p of ['hongguang', 'qing', 'shun']) for (const seed of [3, 7, 11]) {
  let s = createGame(p, seed);
  for (let m = 0; m < 24; m++) {
    const g = resolveMonth(s, []); let r = g.next();
    while (!r.done) { const it = r.value;
      if (it.type === 'battle') { const b = it.battle as BattleState; { const side = b.att.faction === s.player ? 'att' : b.def.faction === s.player ? 'def' : 'att'; (b.kind === 'siege' ? sieges : found).push({ b: structuredClone(b), side }); } r = g.next({ type: 'battle', result: autoResolve(it.battle), manual: false }); }
      else r = g.next({ type: 'choice', index: 0 }); }
    s = r.value.state;
  }
}
let quick = 0;
const rows: string[] = [];
for (const mode of ['passive', 'auto'] as const) for (const { b, side } of found) {
  const sim = createField(b); const foe = side === 'att' ? 'def' : 'att';
  let next = 0;
  while (!sim.over && sim.t < 1200) { if (sim.t >= next) { aiField(sim, foe); if (mode === 'auto') aiField(sim, side); next = sim.t + 2; } stepField(sim, 0.1); }
  const loss = (sd: 'att' | 'def') => sim[sd].start - sim.units.filter(u => u.side === sd).reduce((n, u) => n + Math.max(0, u.troops), 0);
  const la = loss('att'), ld = loss('def');
  const early = (sim.over?.t ?? 9999) < 60 && la + ld < 0.01 * (sim.att.start + sim.def.start);
  if (early) quick++;
  if (true) rows.push(`${mode} ${b.kind} ${b.nodeName} [${b.att.faction}:${b.att.armies.join(",")} vs ${b.def.faction}:${b.def.armies.join(",")}] 攻${Math.round(sim.att.start)}(士${Math.round(sim.att.morale0)}) 守${Math.round(sim.def.start)}(士${Math.round(sim.def.morale0)}) → ${sim.over?.winner}/${sim.over?.outcome} t=${sim.over?.t.toFixed(0)} 折损 ${Math.round(la)}/${Math.round(ld)}${early ? '  ←未战先决' : ''}`);
}
console.log(`野战水战 ${found.length} 场 × 2 种打法，未战先决 ${quick} 次`);
console.log(rows.join('\n'));

// 攻城战：同样看是否“未战先决”
let sq = 0; const srows: string[] = [];
for (const mode of ['passive', 'auto'] as const) for (const { b, side } of sieges) {
  const sim = createSiege(b); const foe = side === 'att' ? 'def' : 'att';
  let next = 0;
  while (!sim.over && sim.t < 1500) { if (sim.t >= next) { aiCommands(sim, foe); if (mode === 'auto') aiCommands(sim, side); next = sim.t + 2; } stepSiege(sim, 0.1); }
  const loss = (sd: 'att' | 'def') => sim[sd].start - sim.units.filter(u => u.side === sd).reduce((n, u) => n + Math.max(0, u.troops), 0);
  const la = loss('att'), ld = loss('def');
  const early = (sim.over?.t ?? 9999) < 30 && la + ld < 0.005 * (sim.att.start + sim.def.start);
  if (early) { sq++; srows.push(`${mode} 攻城 ${b.nodeName} 攻${Math.round(sim.att.start)}(士${Math.round(sim.att.morale0)}) 守${Math.round(sim.def.start)} → ${sim.over?.winner}/${sim.over?.outcome} t=${sim.over?.t.toFixed(0)} 折损 ${Math.round(la)}/${Math.round(ld)}`); }
}
console.log(`攻城战 ${sieges.length} 场 × 2 种打法，未战先决 ${sq} 次`);
console.log(srows.slice(0, 12).join('\n'));
