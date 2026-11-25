/* 经济数值审计：五家开局月度收支表（分季节），以及空过 N 月的钱粮走势。
 * 用法：npx tsx tools/econ-audit.ts [月数=36] [种子=1] */
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { cityForecast, monthlyIncome, grainPrice, forageShare, GRAIN_PER_SOLDIER, SILVER_PER_SOLDIER, SILVER_PER_FIELD_SOLDIER } from '../src/core/economy';
import { lunarOf } from '../src/core/calendar';
import type { GameState } from '../src/core/types';

const MONTHS = Number(process.argv[2] ?? 36), SEED = Number(process.argv[3] ?? 1);
const W = (n: number) => (Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + '万' : String(Math.round(n)));
const P = ['hongguang', 'qing', 'shun', 'xi', 'zheng'];

function sheet(s: GameState, f: string) {
  const cities = Object.values(s.cities).filter(c => c.controller === f);
  let sIn = 0, sOut = 0, gIn = 0, gOut = 0, garrison = 0, stockS = 0, stockG = 0;
  for (const c of cities) {
    const fc = cityForecast(s, c);
    for (const i of fc.silver.items) if (i.kind !== 'remit') { if (i.v > 0) sIn += i.v; else sOut -= i.v; }
    for (const i of fc.grain.items) { if (i.v > 0) gIn += i.v; else gOut -= i.v; }
    garrison += c.garrison; stockS += c.silver; stockG += c.grain;
  }
  // 以外地城为粮台的本方军队（下属支取不算）不在本方城里，单算
  const field = Object.values(s.armies).filter(a => a.faction === f);
  const fieldTroops = field.reduce((n, a) => n + a.troops, 0);
  return { cities: cities.length, garrison, fieldTroops, sIn, sOut, gIn, gOut, stockS, stockG };
}

console.log(`=== 开局月度收支（种子 ${SEED}；三个季节：青黄不接五月、秋收八月、冬月十一月）===`);
for (const f of P) {
  const s0 = createGame(f, SEED);
  const rows: string[] = [];
  for (const k of [0, 3, 6]) {
    const s = structuredClone(s0); s.turn = s0.turn + k;
    const m = lunarOf(s.turn).month;
    const x = sheet(s, f);
    rows.push(`  ${m}月 银 收${W(x.sIn)} 支${W(x.sOut)} 净${W(x.sIn - x.sOut)} | 粮 收${W(x.gIn)} 支${W(x.gOut)} 净${W(x.gIn - x.gOut)}`);
  }
  const x = sheet(s0, f);
  const avgPrice = Object.values(s0.cities).filter(c => c.controller === f).reduce((n, c) => n + grainPrice(s0, c), 0) / Math.max(1, x.cities);
  console.log(`${f}: ${x.cities} 城 驻军 ${W(x.garrison)} 野战 ${W(x.fieldTroops)}（就粮 ${Math.round(forageShare(s0, f) * 100)}%） 存银 ${W(x.stockS)} 存粮 ${W(x.stockG)} 均粮价 ${avgPrice.toFixed(2)}`);
  rows.forEach(r => console.log(r));
}

console.log(`\n=== 空过 ${MONTHS} 月走势（玩家不下令，其余照常）===`);
for (const f of P) {
  let s = createGame(f, SEED);
  const line: string[] = [];
  for (let i = 0; i <= MONTHS; i++) {
    if (i % 6 === 0) {
      const cs = Object.values(s.cities).filter(c => c.controller === f);
      const sv = cs.reduce((n, c) => n + c.silver, 0), gr = cs.reduce((n, c) => n + c.grain, 0);
      const zero = cs.filter(c => c.silver < 1000).length;
      const troops = cs.reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === f).reduce((n, a) => n + a.troops, 0);
      line.push(`${i}月:银${W(sv)} 粮${W(gr)} 兵${W(troops)} 空库${zero}/${cs.length}`);
    }
    if (i < MONTHS && !s.ended) s = runMonthAuto(s, []);
  }
  console.log(f + '\n  ' + line.join('\n  '));
}
// 参考：一名兵一月的钱粮按粮价折银
const s = createGame('hongguang', SEED);
const p = grainPrice(s, s.cities.nanjing);
console.log(`\n参考：驻军一人每月 粮 ${GRAIN_PER_SOLDIER} 石（约 ${(GRAIN_PER_SOLDIER * p).toFixed(2)} 两）+ 银 ${SILVER_PER_SOLDIER} 两；出征 ${SILVER_PER_FIELD_SOLDIER} 两。南京一万口每月赋税约 ${Math.round(monthlyIncome(s, s.cities.nanjing).silver / s.cities.nanjing.pop)} 两、田粮约 ${Math.round(monthlyIncome(s, s.cities.nanjing).grain / s.cities.nanjing.pop)} 石`);
