/* 战斗是否“兵多必胜”：按兵力比、主将统谋扫一遍自动战斗的胜率。npx tsx tools/ai-audit.ts */
import { createBattle, makeSide, autoResolve } from '../src/core/battle';
const side = (name: string, troops: number, tong: number, mou: number, garrison = false) => makeSide({ faction: name, name, commander: name, commanderName: name, tong, mou, wai: 50, surrender: 30,
  mix: { inf: 0.65, cav: 0.2, gun: 0.15, navy: 0 }, stratagems: 2, armies: [], garrison, troops, morale: 70 });
const SEEDS = Array.from({ length: 24 }, (_, i) => (i + 1) * 7919);
const kind = (process.argv[2] ?? 'field') as 'field' | 'siege';
for (const [ta, ma, td, md] of [[60, 55, 60, 55], [40, 35, 85, 85], [85, 85, 40, 35]]) {
  const row: string[] = [];
  for (const r of kind === 'siege' ? [2, 2.5, 3, 3.5, 4] : [0.6, 0.75, 0.9, 1, 1.2, 1.5]) {
    let w = 0;
    for (const seed of SEEDS) {
      const b = createBattle({ id: 'x', kind, node: 'x', nodeName: 'x', terrain: kind === 'siege' ? 'city' : 'plain', weather: 'clear', att: side('攻', 30000 * r, ta, ma), def: side('守', 30000, td, md, kind === 'siege'), wall: 60, seed });
      if (autoResolve(b).winner === 'att') w++;
    }
    row.push(`${r}:${Math.round(w / SEEDS.length * 100)}%`);
  }
  console.log(`攻统${ta}谋${ma} vs 守统${td}谋${md}  `, row.join('  '));
}
