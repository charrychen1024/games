/* 无界面模拟：npx tsx tools/sim.ts [月数] [种子] —— 打印月报与关键数值，用于调平衡 */
import { createState1644 } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { shortDate } from '../src/core/calendar';
import { nodeName } from '../src/core/state';

const months = Number(process.argv[2] ?? 12), seed = Number(process.argv[3] ?? 1644);
const quiet = process.argv.includes('-q');
let s = createState1644(seed);
for (let i = 0; i < months && !s.ended; i++) {
  const t = s.turn;
  s = runMonthAuto(s, []);
  if (!quiet) {
    console.log(`\n===== ${shortDate(t)} =====`);
    for (const r of s.reports.filter(r => r.turn === t && !r.faction)) console.log(`[${r.cat}] ${r.text}`);
  }
  const hg = Object.values(s.cities).filter(c => c.controller === 'hongguang');
  const nj = s.cities.nanjing, yz = s.cities.yangzhou;
  console.log(`-- 弘光 ${hg.length} 城；南京 粮${nj.grain} 银${nj.silver} 驻${nj.garrison}；扬州 粮${yz.grain} 银${yz.silver} 驻${yz.garrison} 民${yz.minxin} ${yz.controller}`);
  console.log('-- 军队', Object.values(s.armies).map(a => `${a.name}@${nodeName(a.location)}${a.path.length ? '→' + nodeName(a.path[a.path.length - 1]) : ''}(${Math.round(a.troops / 1000)}k,${a.morale})`).join(' '));
}
const owners: Record<string, string[]> = {};
for (const c of Object.values(s.cities)) (owners[c.controller] ??= []).push(nodeName(c.id));
console.log('\n控制：', Object.entries(owners).map(([f, l]) => `${f}: ${l.join('、')}`).join('\n'));
console.log('史事：', s.events.map(e => e.id + (e.variant === 'altered' ? '*' : '')).join(' '));
