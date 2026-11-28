/* 电脑主动性审计：玩家一方由电脑代下令（模拟一个在扩张的玩家），统计别家对玩家主动出手的次数、错过的可乘之机、外交来往。
 * npx tsx tools/initiative-audit.ts [玩家=xi] [月数=36] [种子...] */
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { aiOrders } from '../src/core/ai';
import { hostile, armyPower, citiesOf, topOf } from '../src/core/state';
import { neighbors } from '../src/data/geography';
import type { GameState, Order } from '../src/core/types';
const P = process.argv[2] ?? 'xi', M = Number(process.argv[3] ?? 36);
const seeds = process.argv.slice(4).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4);
const hold = (s: GameState, n: string) => { const c = s.cities[n]; const inside = Object.values(s.armies).filter(x => x.location === n && x.progress === 0 && topOf(s, x.faction) === topOf(s, c.controller)).reduce((m, x) => m + x.troops, 0); return (c.garrison + inside) * (1 + c.wall / 60); };
let tot = { strikes: 0, missed: 0, chances: 0, lost: 0, offers: 0, wars: 0, battlesAtk: 0 };
for (const seed of seeds) {
  let s = createGame(P, seed);
  const c0 = citiesOf(s, P).length;
  let peak = c0;
  for (let m = 0; m < M && !s.ended; m++) {
    // 玩家由电脑代下令
    const real = s.player; (s as any).player = '__x'; const po: Order[] = aiOrders(s, P); (s as any).player = real;
    const mine = new Set(citiesOf(s, P).map(c => c.id));
    // 机会：玩家城弱，邻近敌军或敌城驻军远强于之
    const chances = new Set<string>();
    for (const id of mine) {
      const h = hold(s, id);
      for (const { to } of neighbors(id)) {
        const c = s.cities[to];
        const armies = Object.values(s.armies).filter(a => a.location === to && a.progress === 0 && hostile(s, a.faction, P)).reduce((n, a) => n + armyPower(a, s), 0);
        const gar = c && hostile(s, c.controller, P) ? c.garrison : 0;
        if (armies + gar * 0.6 > h * 1.6 + 3000) chances.add(id);
      }
    }
    const turn = s.turn;
    const before = Object.fromEntries(Object.values(s.armies).map(a => [a.id, a.path[a.path.length - 1]]));
    s = runMonthAuto(s, po, it => it.type === 'choice' ? { type: 'choice', index: 0 } : undefined);
    const targeted = new Set<string>();
    for (const a of Object.values(s.armies)) if (a.faction !== P && hostile(s, a.faction, P)) { const t = a.path[a.path.length - 1] ?? (a.order as any).target; if (t && mine.has(t)) { targeted.add(t); if (before[a.id] !== t) tot.strikes++; } }
    for (const id of mine) if (s.cities[id].controller !== P && topOf(s, s.cities[id].controller) !== topOf(s, P)) { tot.lost++; targeted.add(id); }
    tot.chances += chances.size; tot.missed += [...chances].filter(c => !targeted.has(c)).length;
    tot.offers += s.reports.filter(r => r.turn === turn && r.cat === '交涉').length;
    tot.battlesAtk += s.reports.filter(r => r.turn === turn && /来攻|进犯|攻我/.test(r.text)).length;
    peak = Math.max(peak, citiesOf(s, P).length);
  }
  console.log(`种子${seed}: ${P} 城 ${c0}→${citiesOf(s, P).length}（峰 ${peak}）`);
}
console.log(`别家新发起攻玩家 ${tot.strikes} 次；失城 ${tot.lost}；可乘之机 ${tot.chances} 城·月，未出手 ${tot.missed}；交涉月报 ${tot.offers}`);
