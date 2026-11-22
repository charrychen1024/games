/* 从 game-icons.net（CC BY 3.0，经 @iconify-json/game-icons）抽取用到的图标，写入 src/ui/icons.ts。
 * 新增图标：在 USE 里加一项后重跑 node tools/build-icons.mjs */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('@iconify-json/game-icons/icons.json');
const USE = {
  silver: 'two-coins', grain: 'wheat', city: 'castle', troops: 'rally-the-troops', wall: 'stone-wall', minxin: 'heart-plus',
  order: 'scales', agri: 'plow', commerce: 'money-stack', edu: 'graduate-cap', pop: 'village', date: 'sundial', next: 'fast-forward-button',
  report: 'scroll-unfurled', factions: 'flying-flag', chars: 'person', save: 'save', sound: 'speaker', mute: 'speaker-off', exit: 'exit-door',
  recruit: 'barracks', transfer: 'cargo-crate', appoint: 'wax-seal', policy: 'quill-ink', persuade: 'envelope', envoy: 'shaking-hands',
  reward: 'coins', move: 'direction-sign', attack: 'sword-clash', hold: 'shield', siege: 'siege-tower', blockade: 'palisade',
  reinforce: 'team-upgrade', locate: 'eye-target', why: 'magnifying-glass', history: 'open-book', urgent: 'trumpet-flag',
  war: 'crossed-swords', capture: 'tower-flag', admin: 'abacus', person: 'person', event: 'scroll-quill', clue: 'lantern-flame',
  morale: 'strong', navy: 'galleon', cav: 'horse-head', gun: 'cannon', inf: 'pikeman', flank: 'convergence-target', volley: 'musket',
  charge: 'cavalry', withdraw: 'run', storm: 'ladder', bombard: 'cannon', sap: 'hole', sortie: 'fist', repair: 'hammer-nails',
  ambush: 'spy', fire: 'fire', night: 'night-sky', info: 'info', close: 'cancel', ok: 'check-mark', crown: 'crown', prisoner: 'prisoner',
  dead: 'skull-crossed-bones', hourglass: 'hourglass', auto: 'gears', supply: 'wheat', army: 'spears', play: 'play-button', target: 'triangle-target',
  load: 'open-book', newgame: 'crown', map: 'compass', help: 'info', battle: 'sword-clash', port: 'anchor', pass: 'temple-gate', ferry: 'sailboat',
};
const out = {};
for (const [k, name] of Object.entries(USE)) {
  const ic = data.icons[name];
  if (!ic) throw new Error('missing icon ' + name);
  // 去掉 game-icons 自带的黑底方块，只留图形
  out[k] = ic.body.replace(/<path d="M0 0h512v512H0z"\/>/, '').replace(/fill="#fff"/g, 'fill="currentColor"').replace(/fill="#000"/g, 'fill="currentColor"');
}
const src = `/* 自动生成：node tools/build-icons.mjs。图标来自 game-icons.net（作者 Lorc、Delapouite 等），CC BY 3.0。 */
export const ICONS: Record<string, string> = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n  "')};
export type IconName = keyof typeof ICONS;
/** 返回内联 SVG 字符串 */
export function iconSvg(name: string, cls = 'ic'): string {
  const body = ICONS[name] ?? ICONS.info;
  return '<svg class="' + cls + '" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">' + body + '</svg>';
}
`;
fs.writeFileSync(new URL('../src/ui/icons.ts', import.meta.url), src);
console.log('icons', Object.keys(out).length, (src.length / 1024).toFixed(1) + 'KB');
