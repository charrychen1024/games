/* 政权更替：君主被俘或身故时的继统，明室正统在各势力间转移，势力分裂。
 * 名号更替只改政权一层（年号），不重建势力。 */
import type { Era, Faction, GameState, Polity } from './types';
import { POLITIES } from '../data/factions';
import { lunarOf } from './calendar';
import { adjustAtt, adjustLoyalty, citiesOf, treasuryOf, friendly, hostile, nodeName, report, factionName } from './state';
import { distanceKm, NODE } from '../data/geography';
import { rngFor } from './rng';

/** 带本局年号记录的政权 */
export function polityOf(s: GameState, pid: string): Polity {
  const base = POLITIES[pid] ?? POLITIES.none;
  const eras = s.eras?.[pid];
  return eras ? { ...base, eras } : base;
}

export function pushEra(s: GameState, pid: string, name: string) {
  s.eras ??= {};
  const cur = (s.eras[pid] ?? POLITIES[pid]?.eras ?? []).filter(e => e.fromTurn <= s.turn);
  const e: Era = { name, firstYear: lunarOf(s.turn).year, fromTurn: s.turn };
  s.eras[pid] = [...cur, e];
}

/** 明室正统所在的势力 */
export const courtOf = (s: GameState): string | undefined => {
  const c = s.flags.ming_court;
  return typeof c === 'string' && s.factions[c] && !s.factions[c].defunct ? c : undefined;
};

export function isRuler(s: GameState, f: string): boolean {
  return !!s.factions[f] && f === s.flags.ming_court;
}

/** 可拥立的宗室：在世、未被执，身处不与本方敌对之地 */
export function royalCandidates(s: GameState, f: string) {
  return Object.values(s.chars).filter(c => c.royal && c.status === 'active' && c.id !== s.factions[f]?.leader
    && !hostile(s, f, s.cities[c.location]?.controller ?? f) && (s.factions[c.faction]?.polity === 'ming' || c.faction === f))
    .sort((a, b) => b.royal!.claim - a.royal!.claim || b.ab.wang - a.ab.wang);
}

export interface SuccessionOpt { kind: 'enthrone' | 'regent' | 'ransom' | 'minister' | 'appointed' | 'summon' | 'join'; char: string; label: string; desc: string; disabled?: string; target?: string }
export const RANSOM_SILVER = 150000;

/** 继统方案：说明支持者与代价 */
export function successionOptions(s: GameState, f: string): SuccessionOpt[] {
  const fac = s.factions[f];
  const old = s.chars[String(s.flags['old_ruler_' + f] ?? '')];
  const out: SuccessionOpt[] = [];
  const hawks = Object.values(s.chars).filter(c => c.faction === f && c.status === 'active' && c.att.hawk > 40).map(c => c.name).slice(0, 3);
  const doves = Object.values(s.chars).filter(c => c.faction === f && c.status === 'active' && c.att.hawk < 0).map(c => c.name).slice(0, 3);
  const royals = f === courtOf(s) ? royalCandidates(s, f) : [];
  for (const r of royals.slice(0, 2)) {
    out.push({ kind: 'enthrone', char: r.id, label: `拥立${r.name}即位，改元${r.royal!.era.replace(/^监国/, '')}`, desc: `支持：${hawks.join('、') || '主战诸臣'}。代价：${old && old.status === 'captured' ? `旧君${old.name}从此再难迎回；` : ''}各镇须重新归心（服从 −5）。` });
  }
  if (royals[0] && old?.status === 'captured') out.push({ kind: 'regent', char: royals[0].id, label: `请${royals[0].name}监国，待迎旧君`, desc: `支持：${doves.join('、') || '持重诸臣'}。代价：名分未定，号令稍弱（服从 −8）。` });
  if (old?.status === 'captured') {
    const cap = s.cities[treasuryOf(s, f)];
    const have = cap?.silver ?? 0;
    out.push({ kind: 'ransom', char: old.id, label: `遣使议赎，迎回${old.name}`, desc: `需银 15 万两（府库现有 ${Math.round(have / 10000)} 万）。对方未必肯放，成败当月即见分晓；不成则由重臣主事。`,
      disabled: have < RANSOM_SILVER ? `府库不足：尚缺 ${Math.ceil((RANSOM_SILVER - have) / 10000)} 万两` : undefined });
  }
  const court = f === courtOf(s);
  const ministers = Object.values(s.chars).filter(c => c.faction === f && c.status === 'active' && !c.royal).sort((a, b) => b.ab.wang - a.ab.wang).slice(0, court ? 1 : 2);
  for (const m of ministers) out.push(court
    ? { kind: 'minister', char: m.id, label: `由${m.name}主事`, desc: `不立新君。号令出自权臣，下属服从 −12，${m.name}威望日重。` }
    : { kind: 'minister', char: m.id, label: `推${m.name}主事`, desc: `统军 ${m.ab.tong}、政务 ${m.ab.zheng}、威望 ${m.ab.wang}。新主初立，下属服从 −6。` });
  // 本部无人可推：请上级委派、征辟未出之士、或部众投靠
  if (!ministers.length && !royals.length) {
    const lord = fac.overlord && !s.factions[fac.overlord]?.defunct ? s.factions[fac.overlord] : undefined;
    if (lord) {
      const busy = new Set(Object.values(s.armies).map(a => a.commander));
      const sent = Object.values(s.chars).filter(c => c.faction === lord.id && c.status === 'active' && !c.royal && c.id !== lord.leader && !busy.has(c.id) && !s.missions.some(m => (m.order as { char?: string }).char === c.id))
        .sort((a, b) => (b.ab.wang + b.ab.tong) - (a.ab.wang + a.ab.tong))[0];
      if (sent) out.push({ kind: 'appointed', char: sent.id, target: lord.id, label: `请${lord.name}委派${sent.name}主事`, desc: `${sent.name}（统 ${sent.ab.tong}、政 ${sent.ab.zheng}）来主本部。从此更依附上级：服从 +10，日后难以自立。` });
    }
    const mine = new Set(citiesOf(s, f).map(c => c.id));
    const hermit = Object.values(s.chars).filter(c => c.status === 'offstage' && (c.faction === f || (!c.faction && mine.has(c.location))) && s.cities[c.location] && mine.has(c.location))
      .sort((a, b) => (b.ab.wang + b.ab.zheng) - (a.ab.wang + a.ab.zheng))[0];
    if (hermit) out.push({ kind: 'summon', char: hermit.id, label: `征辟${hermit.name}出而主事`, desc: `${hermit.name}尚未出仕，提早延请。资望尚浅：本部各城民心 −3。` });
    const host = lord ?? Object.values(s.factions).find(x => !x.defunct && x.id !== f && s.relations[[f, x.id].sort().join('|')]?.stance === 'alliance');
    if (host && (mine.size || Object.values(s.armies).some(a => a.faction === f))) out.push({ kind: 'join', char: '', target: host.id, label: `部众投靠${host.name}`, desc: `各城各营并入${host.name}。${f === s.player ? '本方从此不复独立，本局到此为止。' : ''}` });
  }
  return out;
}

/** 执行继统方案 */
export function applySuccession(s: GameState, f: string, opt: SuccessionOpt): string {
  const fac = s.factions[f];
  const c = s.chars[opt.char];
  // 议赎银两不足：方案不成立，继统仍待议定（不清标记，下回仍可改选）
  if (opt.kind === 'ransom' && (s.cities[treasuryOf(s, f)]?.silver ?? 0) < RANSOM_SILVER) return '府库不足，议赎未成。';
  delete s.flags['need_succession_' + f];
  const vassals = Object.values(s.factions).filter(x => x.overlord === f);
  switch (opt.kind) {
    case 'enthrone': {
      fac.leader = c.id;
      c.faction = f;
      c.title = c.royal!.era.startsWith('监国') ? '监国' : `${c.royal!.era}帝`;
      if (s.cities[c.location]?.controller === f) fac.capital = c.location;
      pushEra(s, fac.polity, c.royal!.era);
      if (fac.polity === 'ming') fac.name = `${c.royal!.era.replace(/^监国/, '')}朝廷`;
      for (const v of vassals) adjustLoyalty(s, v.id, -5, `新君${c.name}即位`);
      report(s, { cat: '人事', urgent: f === s.player, node: fac.capital, text: `${c.name}即位于${nodeName(fac.capital)}，改元${c.royal!.era}。${factionName(s, f)}号令天下。` });
      return `${c.name}即位，改元${c.royal!.era}。`;
    }
    case 'regent': {
      fac.leader = c.id;
      c.faction = f;
      c.title = '监国';
      for (const v of vassals) adjustLoyalty(s, v.id, -8, `${c.name}监国，名分未定`);
      report(s, { cat: '人事', urgent: f === s.player, text: `${c.name}监国，待迎旧君。` });
      return `${c.name}监国。`;
    }
    case 'ransom': {
      const cap = s.cities[treasuryOf(s, f)];
      if (!cap) return '议赎未成。';
      cap.silver -= RANSOM_SILVER;
      s.ledger.push({ turn: s.turn, node: cap.id, field: 'silver', delta: -150000, text: `议赎${c.name}`, src: { kind: 'order', ref: 'ransom:' + f } });
      const keeper = Object.values(s.factions).find(x => x.capital === c.location) ?? null;
      const ok = !keeper || keeper.id !== 'qing' || rngFor(s.seed, 'ransom', f, s.turn).chance(0.35);
      const minister = Object.values(s.chars).filter(x => x.faction === f && x.status === 'active' && !x.royal).sort((a, b) => b.ab.wang - a.ab.wang)[0];
      if (ok) {
        c.status = 'active'; c.location = fac.capital; fac.leader = c.id;
        report(s, { cat: '人事', urgent: true, text: `使臣携银十五万两议赎，${c.name}获释还朝。` });
        return `${c.name}还朝。`;
      }
      if (minister) fac.leader = minister.id;
      report(s, { cat: '人事', urgent: true, text: `${keeper ? keeper.name : '对方'}收银而不放人，${c.name}仍被扣押。${minister ? minister.name + '暂摄国事。' : ''}` });
      return '议赎未成。';
    }
    case 'minister': {
      fac.leader = c.id;
      const court = f === courtOf(s);
      for (const v of vassals) adjustLoyalty(s, v.id, court ? -12 : -6, `${c.name}${court ? '以权臣' : ''}主事`);
      adjustAtt(s, c.id, 'loyalty', 5, '主持国事');
      report(s, { cat: '人事', urgent: f === s.player, text: court ? `${factionName(s, f)}不立新君，由${c.name}主事。` : `${factionName(s, f)}众将推${c.name}主事。` });
      return `${c.name}主事。`;
    }
    case 'appointed': {
      c.faction = f; fac.leader = c.id;
      if (s.cities[fac.capital]?.controller === f) c.location = fac.capital;
      if (fac.overlord) adjustLoyalty(s, f, 10, `${factionName(s, fac.overlord)}委派${c.name}主事`);
      report(s, { cat: '人事', urgent: f === s.player, node: fac.capital, text: `${factionName(s, opt.target ?? '')}委派${c.name}赴${nodeName(fac.capital)}，主持${fac.name}。` });
      return `${c.name}受委主事。`;
    }
    case 'summon': {
      c.status = 'active'; c.faction = f; fac.leader = c.id;
      for (const x of citiesOf(s, f)) x.minxin = Math.max(0, x.minxin - 3);
      report(s, { cat: '人事', urgent: f === s.player, node: c.location, text: `${fac.name}征辟${c.name}出而主事。${c.bio}` });
      return `${c.name}出而主事。`;
    }
    case 'join': {
      const host = s.factions[opt.target ?? ''];
      if (!host) return '无处可投。';
      const n = citiesOf(s, f).length;
      for (const x of Object.values(s.cities)) if (x.controller === f) x.controller = host.id;
      for (const a of Object.values(s.armies)) if (a.faction === f) a.faction = host.id;
      for (const ch of Object.values(s.chars)) if (ch.faction === f && ch.status !== 'dead') ch.faction = host.id;
      fac.defunct = true;
      s.flags['joined_' + f] = host.id;
      for (const v of vassals) { delete v.overlord; delete v.loyalty; }
      report(s, { cat: '易主', act: 'join', from: f, to: host.id, urgent: true, node: fac.capital, text: `${fac.name}群龙无首，所部 ${n} 城与诸营投靠${host.name}。` });
      return '部众投靠。';
    }
  }
}

/** 电脑一方的继统：有宗室则拥立，否则权臣主事 */
export function autoSuccession(s: GameState, f: string) {
  const opts = successionOptions(s, f);
  const ok = opts.filter(o => !o.disabled);
  const pick = ok.find(o => o.kind === 'enthrone') ?? ok.find(o => o.kind === 'minister') ?? ok.find(o => o.kind === 'appointed') ?? ok.find(o => o.kind === 'summon') ?? ok.find(o => o.kind === 'join');
  if (pick) applySuccession(s, f, pick);
  else delete s.flags['need_succession_' + f];
}

/** 明室正统转移：朝廷覆亡后，奉明而城最多的势力继承正统，并拥立宗室 */
export function transferCourt(s: GameState): string | null {
  if (courtOf(s)) return null;
  const old = s.flags.ming_court;
  const cands = Object.values(s.factions).filter(f => !f.defunct && f.polity === 'ming' && f.id !== 'local' && (!f.overlord || s.factions[f.overlord]?.defunct || f.overlord === old))
    .map(f => ({ f, n: citiesOf(s, f.id).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n || Number(b.f.id === 'mingprov') - Number(a.f.id === 'mingprov'));
  const heir = cands[0]?.f;
  if (!heir) { s.flags.ming_court = ''; return null; }
  s.flags.ming_court = heir.id;
  delete heir.overlord;
  delete heir.loyalty;
  // 原奉旧朝者改奉新朝
  for (const f of Object.values(s.factions)) if (f.id !== heir.id && !f.defunct && f.polity === 'ming' && (f.overlord === old || !f.overlord) && f.id !== s.player) { f.overlord = heir.id; f.loyalty = f.loyalty ?? 55; }
  // 拥立宗室：就近迎来
  const royal = Object.values(s.chars).filter(c => c.royal && c.status === 'active' && !hostile(s, heir.id, s.cities[c.location]?.controller ?? heir.id))
    .sort((a, b) => b.royal!.claim - a.royal!.claim || distanceKm(NODE[a.location], NODE[heir.capital]) - distanceKm(NODE[b.location], NODE[heir.capital]))[0];
  if (royal) {
    const where = citiesOf(s, heir.id).some(c => c.id === royal.location) ? royal.location : heir.capital;
    royal.location = where;
    s.flags['old_ruler_' + heir.id] = heir.leader;
    applySuccession(s, heir.id, { kind: 'enthrone', char: royal.id, label: '', desc: '' });
  } else {
    report(s, { cat: '人事', urgent: heir.id === s.player, text: `${heir.name}继承明室号令，然宗室无人可立。` });
  }
  return heir.id;
}

/** 势力分裂：把部分城池、军队、人物分给新势力 */
export function splitFaction(s: GameState, from: string, spec: { id: string; name: string; short: string; color: string; leader: string; cities: string[]; armies: string[]; chars: string[]; polity?: string; overlord?: string; capital?: string; doctrine: string }): Faction {
  const src = s.factions[from];
  const nf: Faction = { id: spec.id, name: spec.name, short: spec.short, color: spec.color, polity: spec.polity ?? src.polity, leader: spec.leader,
    capital: spec.capital ?? spec.cities[0] ?? src.capital, playable: true, doctrine: spec.doctrine };
  if (spec.overlord) { nf.overlord = spec.overlord; nf.loyalty = 60; }
  s.factions[nf.id] = nf;
  for (const id of spec.cities) if (s.cities[id]) s.cities[id].controller = nf.id;
  for (const id of spec.armies) if (s.armies[id]) s.armies[id].faction = nf.id;
  for (const id of spec.chars) if (s.chars[id]) s.chars[id].faction = nf.id;
  // 与原势力的敌友：沿用原势力对外关系
  for (const [k, r] of Object.entries(s.relations)) {
    const [a, b] = k.split('|');
    if (a === from || b === from) { const other = a === from ? b : a; if (other !== nf.id) s.relations[[nf.id, other].sort().join('|')] = { ...r }; }
  }
  for (const sg of Object.values(s.sieges)) if (spec.armies.some(a => sg.armies.includes(a)) && sg.attacker === from) sg.attacker = nf.id;
  if (src.capital && s.cities[src.capital]?.controller !== from) {
    const rest = citiesOf(s, from).sort((a, b) => b.pop - a.pop);
    if (rest[0]) src.capital = rest[0].id;
  }
  return nf;
}

/** 本月需要继统的势力（由 military.succession 记下） */
export function pendingSuccessions(s: GameState): string[] {
  return Object.keys(s.flags).filter(k => k.startsWith('need_succession_') && s.flags[k]).map(k => k.slice('need_succession_'.length)).filter(f => s.factions[f] && !s.factions[f].defunct);
}

export function friendlyToCourt(s: GameState, f: string): boolean { const c = courtOf(s); return !!c && friendly(s, c, f); }
