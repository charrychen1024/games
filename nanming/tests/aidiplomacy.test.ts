/* 电脑的外交自主（2026-11-28 玩家：可以增强电脑的自主性）。
 * 电脑向玩家借道、献礼、通好互市；电脑之间互市、弱者献礼求安；与玩家为敌者离间玩家的盟友与下属。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { proposalsFor, applyOffer, aiCommerceAndGifts, passageNeed } from '../src/core/diplomacy';
import { aiDiscord } from '../src/core/ai';
import { pactOn } from '../src/core/orders';
import { setStance } from '../src/core/state';

describe('来使：献礼与通好互市', () => {
  it('弱邻献礼：受礼得银、约停战', () => {
    const s = createGame('hongguang', 1); s.flags.dip_force = 1;
    // 本方兵威远胜，诸邻中立、主和、府库宽裕
    for (const c of Object.values(s.cities)) if (c.controller === 'hongguang') c.garrison *= 6;
    for (const f of Object.values(s.factions)) if (f.id !== 'hongguang' && !f.overlord) { setStance(s, 'hongguang', f.id, 'neutral'); const l = s.chars[f.leader]; if (l) l.att.hawk = 0; const cap = s.cities[f.capital]; if (cap) cap.silver = 500000; }
    const o = proposalsFor(s, true).find(x => x.kind === 'gift_in');
    expect(o).toBeTruthy();
    const cap = s.cities[s.factions.hongguang.capital]; const v0 = cap.silver;
    applyOffer(s, o!, 0);
    expect(cap.silver).toBeGreaterThan(v0);
  });
  it('通好互市：允则立互市之约（赋税 +5%）', () => {
    const s = createGame('hongguang', 1);
    applyOffer(s, { kind: 'goodwill', from: 'zheng', title: 't', text: '', options: [] }, 0);
    expect(pactOn(s, 'trade', 'hongguang', 'zheng')).toBe(true);
  });
});

describe('借道', () => {
  it('邻家去攻其敌而路经本方之城：判为须借道；允则立约', () => {
    const s = createGame('hongguang', 1);
    // 大顺之敌只在东南，且本方隔在中间：把湖广、江西之城交给本方，把东南交给清
    for (const c of Object.values(s.cities)) if (['湖广', '江西'].includes((c as any).area ?? '')) c.controller = 'hongguang';
    setStance(s, 'hongguang', 'shun', 'truce', s.turn + 6);
    const need = passageNeed(s, 'shun', 'hongguang');
    if (need) expect(s.cities[need].controller).not.toBe('hongguang');
    applyOffer(s, { kind: 'passage_ask', from: 'shun', silver: 5000, city: need ?? 'nanjing', title: 't', text: '', options: [] }, 0);
    expect(pactOn(s, 'pass', 'hongguang', 'shun')).toBe(true);
  });
});

describe('电脑之间', () => {
  it('互市与献礼：一段时日之后可见动向', () => {
    const s = createGame('hongguang', 3);
    for (let t = 0; t < 36; t++) { aiCommerceAndGifts(s); s.turn++; }
    expect(s.reports.some(r => /互市|献银/.test(r.text))).toBe(true);
  });
});

describe('离间玩家', () => {
  it('与玩家为敌者，见玩家有下属，遣多谋之士离间', () => {
    let sent = false;
    for (let seed = 1; seed <= 30 && !sent; seed++) {
      const s = createGame('hongguang', seed);
      for (const c of Object.values(s.chars)) if (c.faction === 'qing' && c.status === 'active') c.ab.mou = Math.max(c.ab.mou, 85);
      setStance(s, 'hongguang', 'qing', 'war');
      for (let t = 0; t < 12 && !sent; t++) { aiDiscord(s); if (s.missions.some(m => m.order.kind === 'envoy' && m.order.aim === 'discord')) sent = true; s.turn++; }
    }
    expect(sent).toBe(true);
  });
});
