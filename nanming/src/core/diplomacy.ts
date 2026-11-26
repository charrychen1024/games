/* 议和与交涉：各家主动遣使（求和、结盟、招抚），玩家遣使后对方开条件，电脑各家之间的外交往来。
 * 来使以抉择呈给玩家：答应、讨价还价或拒绝；讨价还价有成有败，看对方虚实与主将脾性。
 * 电脑各家之间的议和、结盟写进月报，作为天下的外交动向。 */
import type { GameState } from './types';
import { hostile, stance, setStance, report, factionName, nodeName, citiesOf, topOf, adjustAtt, bump, treasuryOf } from './state';
import { rngFor } from './rng';
import { capture, defectFaction } from './military';
import { courtOf } from './regime';
import { distanceKm, NODE, neighbors } from '../data/geography';

export type OfferKind = 'truce_ask' | 'alliance_offer' | 'summon' | 'tribute_demand' | 'goodwill';
export interface Offer {
  kind: OfferKind;
  from: string;
  title: string;
  text: string;
  /** 求和时献的犒银 */
  silver?: number;
  /** 可索要的城 */
  city?: string;
  /** 讨价还价的成算（0—1） */
  odds?: number;
  options: { label: string; desc: string; disabled?: string }[];
}

/** 一家的兵力：野战各军加各城驻军 */
export function strengthOf(s: GameState, f: string): number {
  let n = 0;
  for (const a of Object.values(s.armies)) if (a.faction === f) n += a.troops;
  for (const c of Object.values(s.cities)) if (c.controller === f) n += c.garrison;
  return n;
}
const MINOR = new Set(['local', 'helan']);
const live = (s: GameState, f: string) => !!s.factions[f] && !s.factions[f].defunct && !MINOR.has(f);
const hawkOf = (s: GameState, f: string) => s.chars[s.factions[f]?.leader]?.att.hawk ?? 0;
const leaderName = (s: GameState, f: string) => s.chars[s.factions[f]?.leader]?.name ?? factionName(s, f);
const capSilver = (s: GameState, f: string) => s.cities[treasuryOf(s, f)]?.silver ?? 0;
const cooled = (s: GameState, key: string, months: number) => s.turn - Number(s.flags[key] ?? -999) >= months;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 两家是否接壤或相去不远：一方的城或军队在另一方城池两站之内 */
export function nearby(s: GameState, a: string, b: string, hops = 2): boolean {
  const near = new Set<string>();
  let frontier = Object.values(s.cities).filter(c => c.controller === b).map(c => c.id);
  for (const x of Object.values(s.armies)) if (x.faction === b) frontier.push(x.location);
  frontier.forEach(n => near.add(n));
  for (let k = 0; k < hops; k++) { const next: string[] = []; for (const n of frontier) for (const { to } of neighbors(n)) if (!near.has(to)) { near.add(to); next.push(to); } frontier = next; }
  return Object.values(s.cities).some(c => c.controller === a && near.has(c.id)) || Object.values(s.armies).some(x => x.faction === a && near.has(x.location));
}
/** 一个阵营（宗主及其下属）的兵力 */
export function blocStrength(s: GameState, head: string): number {
  return Object.keys(s.factions).filter(f => live(s, f) && topOf(s, f) === head).reduce((n, f) => n + strengthOf(s, f), 0);
}
/** 天下最强的阵营之主（结盟总是为了对付它） */
export function hegemon(s: GameState): string | undefined {
  const heads = [...new Set(Object.keys(s.factions).filter(f => live(s, f)).map(f => topOf(s, f)))].filter(f => live(s, f));
  return heads.sort((x, y) => blocStrength(s, y) - blocStrength(s, x))[0];
}
/** 清志在一统，不与人结盟，只招抚 */
const allyable = (s: GameState, f: string) => s.factions[f]?.polity !== 'qing';

/** 对方可割让的一城：离我治所最近、人口最少的那座（对方须有两城以上，治所不割） */
function cedable(s: GameState, from: string, to: string): string | undefined {
  const mine = s.factions[to]?.capital;
  const list = citiesOf(s, from).filter(c => c.id !== s.factions[from].capital);
  if (!list.length || !mine || !NODE[mine]) return undefined;
  return list.sort((a, b) => distanceKm(NODE[a.id], NODE[mine]) - distanceKm(NODE[b.id], NODE[mine]) || a.pop - b.pop)[0]?.id;
}

/** 本月来找玩家的使者。all 为真时不掷骰（测试与预览用），冷却照算；每月至多一家 */
export function proposalsFor(s: GameState, all = false): Offer[] {
  const P = s.player, me = topOf(s, P);
  if (!live(s, P)) return [];
  const force = !!s.flags.dip_force;
  const out: Offer[] = [];
  const pS = strengthOf(s, P);
  // 来使之间至少隔两个月
  if (!all && !force && !cooled(s, 'dip_last', 2)) return [];
  const top = hegemon(s);
  for (const F of Object.keys(s.factions).sort()) {
    // 有宗主的下属不自行议和结盟，由宗主做主
    if (F === P || !live(s, F) || topOf(s, F) === me || s.factions[P].overlord === F || s.factions[F].overlord) continue;
    if (!cooled(s, 'dip_' + F, 8)) continue;
    if (!nearby(s, F, P)) continue;
    const roll = rngFor(s.seed, 'dip', s.turn, F).next();
    const fS = strengthOf(s, F), hawk = hawkOf(s, F);
    const war = hostile(s, F, P);
    // 招抚：强敌兵力两倍于我
    if (war && fS > pS * 2 && citiesOf(s, F).length >= 5 && (all || force || roll < 0.3)) {
      const court = courtOf(s) === P;
      out.push({ kind: 'summon', from: F, title: `${factionName(s, F)}遣使招抚`,
        text: `${leaderName(s, F)}遣使持书而来：“${factionName(s, F)}兵威正盛（约 ${Math.round(fS / 10000)} 万，贵方约 ${Math.round(pS / 10000)} 万），若肯归附，保全城池部伍，另加封赏。”`,
        options: [
          { label: '斩使明志', desc: '断其念想：本方诸将主战 +3，治所民心 +3；两家照旧交兵。' },
          { label: '虚与委蛇，借机缓兵', desc: '假意周旋，约五成能换来四个月停战；被识破则对方更急于来攻。' },
          { label: '受抚归附', desc: `改奉${factionName(s, F)}，城池部伍仍归本方，但听其号令。`, disabled: court ? '明室朝廷，不能受抚' : undefined },
        ] });
      continue;
    }
    // 求和：战事不利、主将不甚好战
    if (war && fS < pS * 0.7 && hawk < 60 && (all || force || roll < 0.5)) {
      const silver = Math.round(Math.min(capSilver(s, F) * 0.3, 50000) / 1000) * 1000;
      const city = citiesOf(s, F).length >= 2 ? cedable(s, F, P) : undefined;
      const odds = clamp(0.2 + (1 - fS / (pS * 0.7)) * 0.5 + (50 - hawk) / 200, 0.1, 0.8);
      out.push({ kind: 'truce_ask', from: F, silver, city, odds, title: `${factionName(s, F)}来使求和`,
        text: `${factionName(s, F)}连月交兵不利（约 ${Math.round(fS / 10000 * 10) / 10} 万对我 ${Math.round(pS / 10000 * 10) / 10} 万），${leaderName(s, F)}遣使来营，愿罢兵修好${silver ? `，献银 ${silver} 两为犒` : ''}。`,
        options: [
          { label: `准和${silver ? `，受犒银 ${silver} 两` : ''}`, desc: '两家停战一年，到期复为交战。' },
          city ? { label: `索要${nodeName(city)}为和议之条件`, desc: `成算约 ${Math.round(odds * 100)}%：成则得${nodeName(city)}并停战一年；不成则使者愤然而去，两家照旧交兵、对方更恨。` }
            : { label: '索要加倍犒银', desc: `成算约 ${Math.round(odds * 100)}%：成则得银加倍并停战；不成则照旧交兵。` },
          { label: '拒绝来使', desc: '两家照旧交兵。' },
        ] });
      continue;
    }
    const st = stance(s, F, P);
    // 强邻索饷：不交兵而兵力远胜、主将好战，遣使要银
    if (st === 'neutral' && fS > pS * 1.5 && hawk >= 30 && (all || force || roll < 0.25)) {
      const silver = Math.round(Math.max(10000, Math.min(capSilver(s, P) * 0.15, 60000)) / 1000) * 1000;
      const odds = clamp(0.35 + (60 - hawk) / 150, 0.15, 0.65);
      out.push({ kind: 'tribute_demand', from: F, silver, odds, title: `${factionName(s, F)}遣使索饷`,
        text: `${factionName(s, F)}兵临境上（约 ${Math.round(fS / 10000)} 万，贵方约 ${Math.round(pS / 10000)} 万），${leaderName(s, F)}遣使索要犒军银 ${silver} 两，言下之意，不给便要动兵。`,
        options: [
          { label: `给银 ${silver} 两求安`, desc: '两家约定停战一年。', disabled: capSilver(s, P) < silver ? '治所府库不足' : undefined },
          { label: '讨价还价，只给一半', desc: `成算约 ${Math.round(odds * 100)}%：成则给一半、停战一年；不成则对方多半起兵来攻。`, disabled: capSilver(s, P) < silver / 2 ? '治所府库不足' : undefined },
          { label: '拒绝', desc: '一文不给；对方约有六成会宣战。' },
        ] });
      continue;
    }
    // 通好互市：不交兵、兵力相当或较弱的邻家来约
    if (st === 'neutral' && fS <= pS * 1.5 && hawk < 50 && (all || force || roll < 0.25)) {
      out.push({ kind: 'goodwill', from: F, title: `${factionName(s, F)}来使通好`,
        text: `${leaderName(s, F)}遣使来约通好：两家边境互市，各守疆界，互不相犯。`,
        options: [
          { label: '通好互市', desc: '两家约两年互不相犯；互市之利，两家治所各得银八千两。' },
          { label: '婉拒', desc: '维持现状。' },
        ] });
      continue;
    }
    // 结盟：两家不交兵，又有共同的强敌
    if ((st === 'neutral' || st === 'truce') && !s.factions[F].overlord && allyable(s, F) && allyable(s, P) && (all || force || roll < 0.35)) {
      // 共同的敌人须是天下最强的一家
      const foe = top && top !== F && top !== me && hostile(s, F, top) && hostile(s, P, top) && blocStrength(s, top) > fS ? top : undefined;
      if (!foe) continue;
      out.push({ kind: 'alliance_offer', from: F, title: `${factionName(s, F)}来使议盟`,
        text: `${factionName(s, F)}与贵方同受${factionName(s, foe)}之逼（${factionName(s, foe)}一方约 ${Math.round(blocStrength(s, foe) / 10000)} 万），${leaderName(s, F)}遣使来议结盟，共御强敌。`,
        options: [
          { label: '结为盟好', desc: '两家结盟：各守其城，互不相犯，合力对敌。' },
          { label: '只议停战两年', desc: '互不相犯，但不结盟。' },
          { label: '婉拒', desc: '维持现状。' },
        ] });
    }
  }
  if (all) return out;
  const pri: Record<OfferKind, number> = { summon: 0, tribute_demand: 1, truce_ask: 2, alliance_offer: 3, goodwill: 4 };
  return out.sort((a, b) => pri[a.kind] - pri[b.kind]).slice(0, 1);
}

/** 玩家对来使的答复。返回一句结果，并记入月报 */
export function applyOffer(s: GameState, o: Offer, idx: number): string {
  const P = s.player, F = o.from;
  s.flags['dip_' + F] = s.turn; s.flags.dip_last = s.turn;
  const rng = rngFor(s.seed, 'dipans', s.turn, F);
  let text = '', ok = true;
  const cap = treasuryOf(s, P);
  /** 银两由 from 府库转入 to 府库：实付多少，对方就收多少 */
  const transfer = (from: string, to: string, v: number, outText: string, inText: string, ref: string) => {
    const paid = -bump(s, from, 'silver', -v, outText, { kind: 'diplomacy', ref });
    if (paid > 0) bump(s, to, 'silver', paid, inText, { kind: 'diplomacy', ref });
    return paid;
  };
  switch (o.kind) {
    case 'truce_ask':
      if (idx === 0) {
        setStance(s, P, F, 'truce', s.turn + 12);
        if (o.silver) transfer(treasuryOf(s, F), cap, o.silver, `向${factionName(s, P)}求和献犒`, `${factionName(s, F)}求和献犒`, 'truce:' + F);
        text = `准${factionName(s, F)}求和，两家停战一年${o.silver ? `，受犒银 ${o.silver} 两` : ''}。`;
      } else if (idx === 1) {
        if (rng.next() < (o.odds ?? 0.3)) {
          setStance(s, P, F, 'truce', s.turn + 12);
          if (o.city && s.cities[o.city]?.controller === F) { capture(s, o.city, P, '归附'); text = `${factionName(s, F)}割${nodeName(o.city)}求和，两家停战一年。`; }
          else { const v = transfer(treasuryOf(s, F), cap, (o.silver ?? 10000) * 2, `向${factionName(s, P)}求和献犒`, `${factionName(s, F)}求和献犒`, 'truce:' + F); text = `${factionName(s, F)}加倍献犒 ${v} 两求和，两家停战一年。`; }
        } else {
          ok = false;
          adjustAtt(s, s.factions[F].leader, 'hawk', 10, `${factionName(s, P)}索要过甚`);
          text = `${leaderName(s, F)}不允所求，使者愤然而去，两家照旧交兵。`;
        }
      } else { ok = false; text = `拒绝${factionName(s, F)}来使，两家照旧交兵。`; }
      break;
    case 'summon':
      if (idx === 0) {
        for (const c of Object.values(s.chars)) if (c.faction === P && c.status === 'active') adjustAtt(s, c.id, 'hawk', 3, `斩${factionName(s, F)}来使`);
        bump(s, cap, 'minxin', 3, '斩使明志', { kind: 'diplomacy', ref: 'summon:' + F });
        ok = false; text = `斩${factionName(s, F)}来使，以明心志。`;
      } else if (idx === 1) {
        if (rng.next() < 0.5) { setStance(s, P, F, 'truce', s.turn + 4); text = `与${factionName(s, F)}虚与周旋，换得四个月停战。`; }
        else { ok = false; adjustAtt(s, s.factions[F].leader, 'hawk', 8, '识破缓兵之计'); text = `${leaderName(s, F)}识破缓兵之计，催兵来攻。`; }
      } else {
        if (courtOf(s) === P) return '明室朝廷，不能受抚。';
        defectFaction(s, P, F);
        text = `${factionName(s, P)}受${factionName(s, F)}招抚，改奉其号令。`;
      }
      break;
    case 'tribute_demand': {
      const pay = (v: number) => { transfer(cap, treasuryOf(s, F), v, `${factionName(s, F)}索饷`, `${factionName(s, P)}所纳`, 'tribute:' + F); };
      const war = () => { setStance(s, P, F, 'war'); };
      if (idx === 0 && capSilver(s, P) >= (o.silver ?? 0)) { pay(o.silver ?? 0); setStance(s, P, F, 'truce', s.turn + 12); text = `纳银 ${o.silver} 两，与${factionName(s, F)}停战一年。`; }
      else if (idx === 1 && capSilver(s, P) >= (o.silver ?? 0) / 2) {
        if (rng.next() < (o.odds ?? 0.4)) { pay(Math.round((o.silver ?? 0) / 2)); setStance(s, P, F, 'truce', s.turn + 12); text = `讨价还价，只纳银 ${Math.round((o.silver ?? 0) / 2)} 两，与${factionName(s, F)}停战一年。`; }
        else if (rng.next() < 0.8) { ok = false; war(); text = `${leaderName(s, F)}嫌少，拂袖而去，两家开战。`; }
        else { ok = false; text = `${leaderName(s, F)}嫌少，使者悻悻而去。`; }
      } else if (rng.next() < 0.6) { ok = false; war(); text = `拒绝${factionName(s, F)}索饷，${leaderName(s, F)}起兵来攻。`; }
      else { ok = false; text = `拒绝${factionName(s, F)}索饷，对方一时未敢动兵。`; }
      break;
    }
    case 'goodwill':
      if (idx === 0) {
        setStance(s, P, F, 'truce', s.turn + 24);
        bump(s, cap, 'silver', 8000, `与${factionName(s, F)}互市`, { kind: 'diplomacy', ref: 'goodwill:' + F });
        bump(s, treasuryOf(s, F), 'silver', 8000, `与${factionName(s, P)}互市`, { kind: 'diplomacy', ref: 'goodwill:' + F });
        text = `与${factionName(s, F)}通好互市，两年互不相犯，得互市之利银八千两。`;
      } else { ok = false; text = `婉拒${factionName(s, F)}通好之约。`; }
      break;
    case 'alliance_offer':
      if (idx === 0) { setStance(s, P, F, 'alliance'); text = `与${factionName(s, F)}结为盟好。`; }
      else if (idx === 1) { setStance(s, P, F, 'truce', s.turn + 24); text = `与${factionName(s, F)}约停战两年，不结盟。`; }
      else { ok = false; text = `婉拒${factionName(s, F)}结盟之议。`; }
      break;
  }
  report(s, { cat: '交涉', ok, node: s.factions[F]?.capital, origin: s.factions[F]?.capital, text: `${o.title}：${text}`, src: { kind: 'diplomacy', ref: o.kind + ':' + F } });
  return text;
}

/** 电脑各家之间的外交往来：战事不利者求和，同受强敌者结盟。成败都写进月报，作为天下的外交动向 */
export function aiDiplomacyTalks(s: GameState) {
  const me = s.factions[s.player] ? topOf(s, s.player) : s.player;
  const force = !!s.flags.dip_force;
  const ai = Object.keys(s.factions).filter(f => live(s, f) && f !== s.player && topOf(s, f) !== me && !s.factions[f].overlord).sort();
  let talks = 0;
  for (let i = 0; i < ai.length && talks < 2; i++) for (let j = i + 1; j < ai.length && talks < 2; j++) {
    const A = ai[i], B = ai[j], key = `dip_${A}_${B}`;
    if (!cooled(s, key, 8)) continue;
    const sa = strengthOf(s, A), sb = strengthOf(s, B);
    const rng = rngFor(s.seed, 'aidip', s.turn, key);
    if (hostile(s, A, B)) {
      // 弱者求和；强者主将越不好战越肯允
      const [weak, strong] = sa < sb ? [A, B] : [B, A];
      const ratio = Math.min(sa, sb) / Math.max(1, Math.max(sa, sb));
      if (ratio > 0.6 || hawkOf(s, weak) >= 40 || !nearby(s, A, B) || !(force || rng.next() < 0.3)) continue;
      s.flags[key] = s.turn; talks++;
      const ok = rng.next() < clamp(0.25 + (40 - hawkOf(s, strong)) / 100, 0.05, 0.7);
      if (ok) setStance(s, A, B, 'truce', s.turn + 12);
      report(s, { cat: '交涉', ok, node: s.factions[strong].capital, origin: s.factions[weak].capital,
        text: `【动向】${factionName(s, weak)}遣使赴${factionName(s, strong)}求和，${ok ? '两家约定停战一年' : `${leaderName(s, strong)}不允，战事仍在继续`}。` });
    } else if (stance(s, A, B) === 'neutral' && allyable(s, A) && allyable(s, B)) {
      const top = hegemon(s);
      const foe = top && top !== A && top !== B && hostile(s, A, top) && hostile(s, B, top) && blocStrength(s, top) > Math.max(sa, sb) * 1.5 ? top : undefined;
      if (!foe || !(force || rng.next() < 0.15)) continue;
      s.flags[key] = s.turn; talks++;
      const ok = rng.next() < 0.5;
      if (ok) setStance(s, A, B, 'alliance');
      report(s, { cat: '交涉', ok, node: s.factions[B].capital, origin: s.factions[A].capital,
        text: `【动向】${factionName(s, A)}与${factionName(s, B)}同受${factionName(s, foe)}之逼，遣使议盟，${ok ? '结为盟好' : '各有疑虑，未成'}。` });
    }
  }
}
