/* 天下大势节奏：各剧本放任若干月后各阵营城数（与改动前对照，看主动性改动是否打乱史实节奏）。npx tsx tools/pace-audit.ts [玩家=hongguang] [月数=24] */
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { topOf } from '../src/core/state';
const P = process.argv[2] ?? 'hongguang', M = Number(process.argv[3] ?? 24);
const tally: Record<string, number> = {};
const N = 12;
let ended = 0;
for (let seed = 1; seed <= N; seed++) {
  let s = createGame(P, seed);
  for (let m = 0; m < M && !s.ended; m++) s = runMonthAuto(s, []);
  if (s.ended) ended++;
  for (const c of Object.values(s.cities)) { const t = topOf(s, c.controller); tally[t] = (tally[t] ?? 0) + 1; }
}
console.log(`${P} ${M}月 ×${N}局（终局 ${ended}）：`, Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${(n / N).toFixed(1)}`).join('  '));
