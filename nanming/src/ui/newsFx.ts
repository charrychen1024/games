/* 军报演出判定：一条军报该怎么演、配什么声。
 * 依据是军报记下的事件原因（act）和当时的双方（from / to），不看城池眼下归谁——
 * 否则旁观第三方失城会被当成自己失城，献城会被演成血战，驻扎会被演成交锋。 */
import type { GameState, ReportEntry, ReportAct } from '../core/types';

export type Persp = 'gain' | 'loss' | 'near' | 'far';
export type NewsVisual = 'verdict' | 'breach' | 'handover' | 'clash' | 'siege' | 'lift' | 'camp' | 'event' | 'ripple';
export type NewsSound =
  | 'breachGain' | 'breachLoss' | 'breachFar'
  | 'handGain' | 'handLoss' | 'handFar'
  | 'battleNear' | 'battleFar' | 'siege' | 'lift' | 'retreat' | 'march'
  | 'resultOk' | 'resultFail' | 'urgent' | 'chime' | 'envoy' | 'people' | 'policy'
  | 'ev:lament' | 'ev:death' | 'ev:edict' | 'ev:turn' | 'ev:war' | 'ev:court' | 'ev:omen';
export interface NewsPlan { act?: ReportAct; persp: Persp; visual: NewsVisual; sound: NewsSound; stamp?: string }

function topOf(s: GameState, f: string | undefined): string | undefined {
  let cur = f;
  for (let i = 0; i < 6 && cur; i++) { const o = s.factions[cur]?.overlord; if (!o) return cur; cur = o; }
  return cur;
}

/** 旧存档和预设里的军报没有 act：从文字里认 */
export function actOf(r: ReportEntry): ReportAct | undefined {
  if (r.act) return r.act;
  const t = r.text;
  if (r.cat === '易主') {
    if (t.includes('（陷城）')) return 'breach';
    if (t.includes('（献城）')) return 'yield';
    if (/反正|分裂/.test(t)) return 'revolt';
    return 'join';
  }
  if (r.cat === '军报' || r.cat === '急报') {
    if (/(野战|水战|攻城战)：/.test(t)) return 'battle';
    if (t.includes('开始围城') || t.includes('兵临')) return 'siege';
    if (t.includes('之围已解')) return 'lift';
    if (/退往|溃散|退路/.test(t)) return 'retreat';
    if (r.cat === '军报') return 'march';
  }
  return undefined;
}

export function planNews(s: GameState, r: ReportEntry, me = s.player): NewsPlan {
  const act = actOf(r);
  const mine = topOf(s, me);
  const isMine = (f?: string) => !!f && (f === me || topOf(s, f) === mine);
  const gain = isMine(r.to), loss = isMine(r.from);
  const persp: Persp = act && ['breach', 'yield', 'join', 'revolt'].includes(act)
    ? (gain && !loss ? 'gain' : loss && !gain ? 'loss' : gain && loss ? 'near' : 'far')
    : (gain || loss ? 'near' : 'far');
  const side = (g: NewsSound, l: NewsSound, f: NewsSound): NewsSound => persp === 'gain' ? g : persp === 'loss' ? l : f;
  switch (act) {
    case 'breach': return { act, persp, visual: 'breach', sound: side('breachGain', 'breachLoss', 'breachFar'), stamp: '破' };
    case 'yield': return { act, persp, visual: 'handover', sound: side('handGain', 'handLoss', 'handFar'), stamp: '献' };
    case 'join': return { act, persp, visual: 'handover', sound: side('handGain', 'handLoss', 'handFar'), stamp: '附' };
    case 'revolt': return { act, persp, visual: 'handover', sound: side('handGain', 'handLoss', 'handFar'), stamp: '反' };
    case 'battle': return { act, persp, visual: 'clash', sound: persp === 'near' ? 'battleNear' : 'battleFar' };
    case 'siege': return { act, persp, visual: 'siege', sound: 'siege', stamp: '围' };
    case 'lift': return { act, persp, visual: 'lift', sound: 'lift' };
    case 'retreat': return { act, persp, visual: 'camp', sound: 'retreat' };
    case 'march': return { act, persp, visual: 'camp', sound: 'march' };
  }
  // 号令结果：使者成败、藩镇奉令与否
  if (r.ok !== undefined) return { persp: 'near', visual: 'verdict', sound: r.ok ? 'resultOk' : 'resultFail', stamp: verdictStamp(r) };
  if (r.cat === '史事' || r.cat === '线索') return { persp, visual: 'event', sound: `ev:${r.tone ?? (r.cat === '线索' ? 'omen' : 'court')}` as NewsSound, stamp: r.cat === '史事' ? '史' : '线' };
  if (r.urgent) return { persp, visual: 'ripple', sound: 'urgent' };
  if (r.cat === '交涉') return { persp, visual: 'ripple', sound: 'envoy' };
  if (r.cat === '人事') return { persp, visual: 'ripple', sound: 'people' };
  if (r.cat === '内政') return { persp, visual: 'ripple', sound: 'policy' };
  return { persp, visual: 'ripple', sound: 'chime' };
}

/** 号令结果印文 */
export function verdictStamp(r: ReportEntry): string {
  const t = r.text;
  if (t.includes('劝降')) return r.ok ? '降' : t.includes('扣留') ? '扣' : '拒';
  if (t.includes('出使')) return r.ok ? (t.includes('结盟') ? '盟' : t.includes('停战') ? '停' : '和') : '拒';
  if (t.includes('号令')) return t.includes('只遣') || t.includes('勉强') ? '半' : r.ok ? '奉' : t.includes('下月') ? '缓' : '拒';
  return r.ok ? '成' : '败';
}

/** 战报分组：同一城同一月的几条军报（攻城战、易主、史事、劝降结果……）合成一张卡，只飞一次镜头、只演一次、只响一次。
 * 领头的一条按轻重取：易主 > 号令结果 > 交战 > 史事 > 其余；其余作附注。没有地点的各自成卡。 */
export interface NewsGroup { lead: ReportEntry; rest: ReportEntry[] }
const LEAD_RANK = (r: ReportEntry) => (r.cat === '易主' ? 0 : r.ok !== undefined ? 1 : actOf(r) === 'battle' ? 2 : r.cat === '史事' ? 3 : r.urgent ? 4 : 5);
export function groupNews(reports: ReportEntry[]): NewsGroup[] {
  const byNode = new Map<string, ReportEntry[]>();
  const out: NewsGroup[] = [];
  for (const r of reports) {
    if (!r.node) { out.push({ lead: r, rest: [] }); continue; }
    (byNode.get(r.node) ?? byNode.set(r.node, []).get(r.node)!).push(r);
  }
  for (const list of byNode.values()) {
    const sorted = [...list].sort((a, b) => LEAD_RANK(a) - LEAD_RANK(b));
    out.push({ lead: sorted[0], rest: sorted.slice(1) });
  }
  return out;
}
