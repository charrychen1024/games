/* 清军兵力走势：npx tsx tools/qing-audit.ts */
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { topOf } from '../src/core/state';
const rows: Record<number, number[]> = {};
for (let seed = 1; seed <= 6; seed++) {
  let s = createGame('hongguang', seed);
  for (let m = 1; m <= 24; m++) {
    s = runMonthAuto(s, []);
    if (m % 6 === 0) { const t = Object.values(s.armies).filter(a => topOf(s, a.faction) === 'qing'); (rows[m] ??= []).push(t.reduce((n, a) => n + a.troops, 0), t.length, Object.values(s.cities).filter(c => c.controller === 'shun').length); }
  }
}
for (const [m, v] of Object.entries(rows)) { const k = v.length / 3; const avg = (o: number) => Math.round(v.filter((_, i) => i % 3 === o).reduce((a, b) => a + b, 0) / k); console.log(`m${m} 清野战军 ${avg(0)} 人 ${avg(1)} 支；大顺 ${avg(2)} 城`); }
