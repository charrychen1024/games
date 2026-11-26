/* 人物够不够用：各家每年城数、主官空缺、可用人物（在职、被执、未出仕）。npx tsx tools/char-audit.ts */
import { createGame } from '../src/data/scenario1644';
import { resolveMonth } from '../src/core/turn';
import { autoResolve } from '../src/core/battle';
for (const p of ['hongguang', 'qing']) {
  let s = createGame(p, 7);
  for (let m = 0; m <= 48; m++) {
    if (m % 12 === 0) {
      const rows = Object.values(s.factions).filter(f => !f.defunct && f.id !== 'local').map(f => {
        const cities = Object.values(s.cities).filter(c => c.controller === f.id);
        const empty = cities.filter(c => !c.governor || s.chars[c.governor]?.status !== 'active').length;
        const act = Object.values(s.chars).filter(c => c.faction === f.id && c.status === 'active').length;
        return `${f.short}:${cities.length}城/缺${empty}/人${act}`;
      });
      const cap = Object.values(s.chars).filter(c => c.status === 'captured').length;
      console.log(`[${p}] 第${m}月 ${rows.join(' ')} | 被执${cap}`);
    }
    const g = resolveMonth(s, []); let r = g.next();
    while (!r.done) { const it = r.value; r = it.type === 'battle' ? g.next({ type: 'battle', result: autoResolve(it.battle), manual: false }) : g.next({ type: 'choice', index: 0 }); }
    s = r.value.state;
  }
}
