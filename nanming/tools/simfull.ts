/* 全剧本无界面模拟：npx tsx tools/simfull.ts [玩家势力=hongguang] [种子=1] —— 玩家不下令，看天下大势与耗时 */
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { shortDate } from '../src/core/calendar';
import { citiesOf } from '../src/core/state';

const player = process.argv[2] ?? 'hongguang', seed = Number(process.argv[3] ?? 1);
let s = createGame(player, seed);
const t0 = Date.now();
const snap = () => Object.values(s.factions).filter(f => !f.defunct && citiesOf(s, f.id).length).map(f => `${f.short}${citiesOf(s, f.id).length}`).join(' ');
while (!s.ended) {
  s = runMonthAuto(s, []);
  if (s.turn % 12 === 0 || s.ended) console.log(shortDate(Math.min(s.turn, 228)), '|', snap(), '| 明室:', s.flags.ming_court, s.factions[String(s.flags.ming_court)]?.name ?? '');
}
console.log('结局', s.ended, '耗时', Date.now() - t0, 'ms');
console.log('史事', s.events.length, '人物出仕', Object.values(s.chars).filter(c => c.appear !== undefined && c.status !== 'offstage').map(c => c.name).join('、'));
