/* 成对局面：同一组种子，各跑“放任、增援、补给、交涉”四种玩家策略，比较结果。
 * 用于判断局势改善来自玩家决策还是开局随机差异。
 *   npx tsx tools/compare.ts [局数=30]
 * 策略都是简单的固定规则，只作基线对照，不代表最优打法。 */
import { trialState } from '../src/data/presets';
import { runMonthAuto } from '../src/core/turn';
import { validateOrder } from '../src/core/orders';
import type { GameState, Order } from '../src/core/types';

type Strategy = { name: string; orders: (s: GameState) => Order[] };
let seq = 0;
const id = () => `c${++seq}`;
const ok = (s: GameState, o: Order) => validateOrder(s, s.player, o) === null;

const STRATEGIES: Strategy[] = [
  { name: '放任', orders: () => [] },
  { name: '增援', orders: s => {
    // 督师标营开赴扬州，并号令黄得功部开赴扬州
    const out: Order[] = [];
    const a = s.armies.a_shi;
    if (a && a.location !== 'yangzhou' && !a.path.length) out.push({ id: id(), kind: 'army', army: 'a_shi', order: { kind: 'move', target: 'yangzhou', attack: false } });
    const h = s.armies.a_huang;
    if (h && h.faction === 'huangdegong' && h.location !== 'yangzhou' && !h.path.length) out.push({ id: id(), kind: 'command', vassal: 'huangdegong', army: 'a_huang', order: { kind: 'move', target: 'yangzhou', attack: false }, silver: 5000 });
    return out.filter(o => ok(s, o));
  } },
  { name: '补给', orders: s => {
    // 每月自南京调粮一万石往扬州
    const o: Order = { id: id(), kind: 'transfer', from: 'nanjing', to: 'yangzhou', grain: 10000, silver: 0 };
    return ok(s, o) ? [o] : [];
  } },
  { name: '交涉', orders: s => {
    // 每月犒赏江北四镇中服从最低者
    const v = ['gaojie', 'huangdegong', 'liuzeqing', 'liuliangzuo'].filter(f => s.factions[f]?.overlord === s.player).sort((a, b) => (s.factions[a].loyalty ?? 50) - (s.factions[b].loyalty ?? 50))[0];
    if (!v) return [];
    const o: Order = { id: id(), kind: 'reward', vassal: v, silver: 20000 };
    return ok(s, o) ? [o] : [];
  } },
];

const N = Number(process.argv[2] ?? 30);
const rows: Record<string, { yz: number; nj: number; garrison: number; obey: number; silver: number; battles: number }> = {};
for (const st of STRATEGIES) {
  const acc = { yz: 0, nj: 0, garrison: 0, obey: 0, silver: 0, battles: 0 };
  for (let seed = 0; seed < N; seed++) {
    let s = trialState(seed);
    while (!s.ended) s = runMonthAuto(s, st.orders(s));
    const yz = s.cities.yangzhou;
    acc.yz += yz.controller === 'hongguang' ? 1 : 0;
    acc.nj += s.cities.nanjing.controller === 'hongguang' ? 1 : 0;
    acc.garrison += yz.controller === 'hongguang' ? yz.garrison : 0;
    const vas = ['gaojie', 'huangdegong', 'liuzeqing', 'liuliangzuo'].map(f => s.factions[f]).filter(f => f && f.overlord === 'hongguang');
    acc.obey += vas.length ? vas.reduce((n, f) => n + (f.loyalty ?? 50), 0) / vas.length : 0;
    acc.silver += s.cities.nanjing.silver;
    acc.battles += s.battles.filter(b => [b.attacker, b.defender].some(f => f === 'hongguang' || s.factions[f]?.overlord === 'hongguang')).length;
  }
  rows[st.name] = acc;
}
console.log(`种子 0–${N - 1}，弘光十二回合，史事取第一项、战斗委托电脑`);
console.log('策略\t守住扬州\t守住南京\t扬州守军(均)\t江北服从(均)\t南京存银(均)\t己方参战(均)');
for (const [name, a] of Object.entries(rows)) {
  console.log([name, `${a.yz}/${N}`, `${a.nj}/${N}`, Math.round(a.garrison / N), (a.obey / N).toFixed(1), Math.round(a.silver / N), (a.battles / N).toFixed(1)].join('\t'));
}
