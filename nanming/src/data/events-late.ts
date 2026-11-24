/* 乙酉五月以后至壬寅年末的史事与线索。
 * 史事只在本局局势与史实相符时按史发生；不符则改写或不发生。势力分裂处给玩家选择延续哪一支。
 * 主要参考：顾诚《南明史》、钱海岳《南明史》、《清史稿》诸传、江日昇《台湾外记》。具体日期待考据核对。 */
import type { EventDef } from '../core/events';
import type { GameState } from '../core/types';
import { turnOf } from '../core/calendar';
import { adjustAtt, bump, setStance, hostile, report, armiesOf, citiesOf, topOf, nodeName, armiesAt, stance } from '../core/state';
import { setArmyOrder, captureChar, succession, defectFaction, retreat, handover } from '../core/military';
import { courtOf, splitFaction } from '../core/regime';
import { NODE } from './geography';

const T = (y: number, m: number, leap = false) => turnOf(y, m, leap);
const alive = (s: GameState, id: string) => s.chars[id]?.status === 'active';
const ctrl = (s: GameState, node: string) => s.cities[node]?.controller;
const qingHolds = (s: GameState, node: string) => !!s.cities[node] && topOf(s, s.cities[node].controller) === 'qing';
const courtLeader = (s: GameState) => { const c = courtOf(s); return c ? s.factions[c].leader : ''; };
const SRC = '顾诚《南明史》';
const ev = (e: EventDef) => e;

/** 某人举城反正：城归明室（或指定势力），本人领兵守城 */
function revolt(s: GameState, node: string, to: string, chief: string, troops: number) {
  const c = s.cities[node];
  if (!c) return;
  const old = c.controller;
  c.controller = to;
  c.governor = chief;
  c.garrison = Math.max(c.garrison, Math.round(troops * 0.4));
  delete s.sieges[node];
  const ch = s.chars[chief];
  for (const a of Object.values(s.armies)) if (a.commander === chief) delete s.armies[a.id];
  if (ch) { ch.faction = to; ch.location = node; ch.status = 'active'; adjustAtt(s, chief, 'loyalty', 70 - ch.att.loyalty, `举${nodeName(node)}反正`); }
  const id = `a_rev_${s.nextId++}`;
  s.armies[id] = { id, name: `${ch?.name ?? ''}部`, faction: to, commander: chief, troops: Math.round(troops * 0.6), mix: { inf: 0.6, cav: 0.25, gun: 0.15, navy: 0 }, morale: 70,
    location: node, path: [], progress: 0, order: { kind: 'hold' }, supply: node, hunger: 0 };
  for (const a of armiesAt(s, node)) if (a.id !== id && hostile(s, a.faction, to)) retreat(s, a, true);
  s.flags['lost_' + node] = s.turn;
  report(s, { cat: '易主', act: 'revolt', from: old, to, urgent: true, node, text: `${nodeName(node)}易主（反正）：${ch?.name ?? ''}据城反正，改奉${s.factions[to]?.name ?? ''}。此城原属${s.factions[old]?.name ?? ''}。` });
}

/** 明室一方（朝廷或其盟友），供反正者归属 */
function mingSide(s: GameState): string | null { return courtOf(s) ?? null; }

export const LATE_EVENTS: EventDef[] = [
  /* ---------------- 乙酉（1645） ---------------- */
  ev({
    id: 'ss_nanjing_fall', kind: 'shishi', title: '南京开城', from: T(1645, 5), to: T(1645, 8), node: 'nanjing',
    cond: s => qingHolds(s, 'nanjing'),
    text: s => s.flags.lost_how_nanjing === '陷城' ? '清军攻破南京，留都陷落。江南门户洞开。' : '清军兵临南京，忻城伯赵之龙、礼部尚书钱谦益等率百官开城迎降。留都不战而下。',
    history: '乙酉五月十五日，赵之龙、钱谦益等开城降清，多铎入南京；弘光帝出奔芜湖，旋为降将所执，解送北京。',
    source: SRC + '第五章',
    effect: s => {
      for (const id of ['suzhou', 'changzhou', 'hangzhou', 'songjiang', 'jiaxing', 'huzhou']) bump(s, id, 'minxin', -4, '留都陷落', { kind: 'event', ref: 'ss_nanjing_fall' });
      adjustAtt(s, 'qianqianyi', 'surrender', 20, '开城迎降');
      for (const id of ['huangdaozhou', 'chenzilong', 'zhanghuangyan', 'zhangguowei']) adjustAtt(s, id, 'hawk', 8, '留都陷落，誓不两立');
    },
  }),
  ev({
    id: 'ss_tifa', kind: 'shishi', title: '剃发令再颁', from: T(1645, 6), to: T(1645, 9), node: 'nanjing',
    cond: s => ['nanjing', 'suzhou', 'changzhou', 'yangzhou', 'hangzhou'].some(n => qingHolds(s, n)),
    text: () => '清廷再颁剃发令：限十日之内，官民尽行剃发，“留头不留发，留发不留头”。江南士民群情激愤。',
    history: '顺治二年六月，清廷再颁剃发令。江阴、嘉定、昆山、松江等地士民奋起抗拒，遭到残酷镇压。',
    source: SRC + '第六章',
    chooser: ['qing'],
    choices: () => [
      { label: '严令剃发', desc: '新附各城民心大降，降官更易驯服；江南各地或将起兵抗拒。', apply: s => { tifaApply(s, 1); return '江南新附各城民心大降。'; } },
      { label: '暂缓推行', desc: '江南人心稍安，起事者少；满洲贵族不满，诸王主战之意稍减。', apply: s => { tifaApply(s, 0); for (const id of ['duoduo', 'ajige', 'boluo']) adjustAtt(s, id, 'loyalty', -3, '不满缓行剃发'); return '江南稍安。'; } },
    ],
    effect: s => {
      // 玩家为清时，民心等后果待决断后再结算（见 tifaApply）；电脑清廷按史严令
      if (s.player !== 'qing') tifaApply(s, 1);
    },
  }),
  ev({
    id: 'ss_jiangyin', kind: 'shishi', title: '江阴八十一日', from: T(1645, 7), to: T(1645, 9), node: 'jiangyin',
    cond: s => !!s.flags.tifa_strict && qingHolds(s, 'jiangyin') && alive(s, 'yanyingyuan'),
    altered: s => !qingHolds(s, 'jiangyin') && alive(s, 'yanyingyuan'),
    text: (_s, v) => v === 'history' ? '江阴士民拒不剃发，公推前典史阎应元入城主持，据城抗清。清军屡攻不下。' : '清军未至江阴，阎应元受邀主持城守，募乡兵、修城堞。',
    history: '乙酉闰六月至八月，阎应元、陈明遇率江阴士民守城八十一日，城破后死难者甚众。',
    source: SRC + '第六章',
    effect: (s, v) => {
      if (v === 'history') revolt(s, 'jiangyin', mingSide(s) ?? 'local', 'yanyingyuan', 12000);
      else { bump(s, 'jiangyin', 'wall', 12, '阎应元修城', { kind: 'event', ref: 'ss_jiangyin' }); bump(s, 'jiangyin', 'garrison', 4000, '募乡兵', { kind: 'event', ref: 'ss_jiangyin' }); }
    },
  }),
  ev({
    id: 'xs_jiading', kind: 'xiansuo', title: '嘉定之屠', from: T(1645, 7), to: T(1645, 8), node: 'songjiang',
    cond: s => !!s.flags.tifa_strict && qingHolds(s, 'songjiang'),
    text: () => '嘉定士民起兵拒剃发，降将李成栋三次攻城屠戮。消息传开，苏松一带人心惊惧，也更加切齿。',
    history: '乙酉七八月间，李成栋三屠嘉定，侯峒曾、黄淳耀等殉难。',
    source: '朱子素《嘉定屠城纪略》',
    effect: s => { for (const id of ['songjiang', 'suzhou', 'jiaxing']) bump(s, id, 'minxin', -6, '嘉定之屠', { kind: 'event', ref: 'xs_jiading' }); adjustAtt(s, 'lichengdong', 'surrender', -5, '嘉定之后为清所疑'); },
  }),
  ev({
    id: 'ss_lizicheng_end', kind: 'shishi', title: '李自成殒命九宫山', from: T(1645, 5), to: T(1645, 7), node: 'wuchang',
    cond: s => alive(s, 'lizicheng') && !['xian', 'tongguan'].some(n => ctrl(s, n) === 'shun') && s.player !== 'shun',
    altered: s => alive(s, 'lizicheng') && ctrl(s, 'xian') === 'shun',
    text: (_s, v) => v === 'history' ? '李自成率少数随从行至湖北通山九宫山，遭当地乡兵袭击身亡。大顺余部由李过、高一功等统领。' : '大顺仍据关中，李自成坐镇西安，收拾残部。',
    history: '乙酉五月，李自成在通山九宫山遇害（一说出家），大顺军余部数十万散在湖广。',
    source: SRC + '第五章',
    effect: (s, v) => {
      if (v !== 'history') { adjustAtt(s, 'lizicheng', 'hawk', 3, '据守关中'); return; }
      s.chars.lizicheng.status = 'dead';
      for (const a of Object.values(s.armies)) if (a.commander === 'lizicheng') a.commander = alive(s, 'liguo') ? 'liguo' : a.commander;
      succession(s, 'shun', '李自成遇害');
      if (alive(s, 'liguo')) s.factions.shun.leader = 'liguo';
      s.factions.shun.name = '大顺余部';
    },
  }),
  ev({
    id: 'ss_longwu', kind: 'shishi', title: '唐王即位福州', from: T(1645, 6), to: T(1645, 12), node: 'fuzhou',
    cond: s => courtLeader(s) === 'zhuyujian',
    text: s => `唐王朱聿键在${nodeName(s.factions[courtOf(s)!].capital)}即位，改元隆武。郑芝龙兄弟拥立有功，掌握兵权；隆武帝勤政，志在出闽恢复。郑森受赐国姓，改名成功。`,
    history: '乙酉闰六月二十七日，朱聿键在福州即位，改元隆武；郑芝龙、郑鸿逵兄弟拥兵自重。郑森受赐姓朱，人称国姓爷。',
    source: SRC + '第七章',
    effect: s => {
      if (s.chars.zhengsen) { s.chars.zhengsen.name = '郑成功'; s.chars.zhengsen.title = '招讨大将军'; adjustAtt(s, 'zhengsen', 'loyalty', 5, '受赐国姓'); adjustAtt(s, 'zhengsen', 'hawk', 8, '受赐国姓'); }
      adjustAtt(s, 'huangdaozhou', 'loyalty', 5, '新君勤政');
      adjustAtt(s, 'zhengzhilong', 'loyalty', -5, '与隆武帝意见不合');
    },
  }),
  ev({
    id: 'ss_luwang', kind: 'shishi', title: '鲁王监国绍兴', from: T(1645, 7), to: T(1645, 10), node: 'shaoxing',
    cond: s => alive(s, 'zhuyihai') && !!courtOf(s) && courtLeader(s) !== 'zhuyihai' && !s.factions.lu
      && ['shaoxing', 'ningbo', 'taizhou'].some(n => s.factions[ctrl(s, n) ?? '']?.polity === 'ming'),
    text: s => { const c = courtOf(s)!; const f = s.factions[c]; const lord = s.chars[f.leader];
      return `浙东士绅与张国维、张煌言等奉鲁王朱以海监国于绍兴，凭钱塘江防守，不再听${nodeName(f.capital)}的${f.name}${lord ? '（' + lord.name + '）' : ''}号令。两家各奉一主，争明室正统。`; },
    history: '乙酉七月，鲁王在绍兴称监国，与福州隆武朝廷争正统，两家互不相下。',
    source: SRC + '第八章',
    chooser: ['hongguang', 'mingprov'],
    choices: s => (courtOf(s) && topOf(s, courtOf(s)!) === topOf(s, s.player)) ? [
      { label: '听其监国，暂不相争', desc: '浙东数城另立鲁监国，与朝廷中立，共抗清军。（史实）', apply: s2 => { luSplit(s2); return '浙东自奉鲁王。'; } },
      { label: '遣使责令鲁王归附', desc: '浙东诸城仍归朝廷；张国维、张煌言等心怀不平，忠诚 −8。', apply: s2 => { for (const id of ['zhangguowei', 'zhanghuangyan', 'zhangmingzhen']) adjustAtt(s2, id, 'loyalty', -8, '朝廷不许鲁王监国'); return '鲁王奉诏，浙东未分。'; } },
    ] : [],
    effect: s => {
      if (courtOf(s) && topOf(s, courtOf(s)!) === topOf(s, s.player)) return;
      luSplit(s);
    },
  }),
  ev({
    id: 'ss_zhongzhen', kind: 'shishi', title: '大顺余部联明抗清', from: T(1645, 8), to: T(1646, 6), node: 'changsha',
    cond: s => !s.factions.shun?.defunct && !!courtOf(s) && hostile(s, 'qing', 'shun') && citiesOf(s, 'shun').length < 12,
    text: () => '大顺余部李过、高一功等与明湖广总督何腾蛟、湖北巡抚堵胤锡议和，愿与明军合力抗清。',
    history: '乙酉秋，李过、高一功部受隆武朝封号，号“忠贞营”，与明军联合抗清。',
    source: SRC + '第九章',
    chooser: ['shun'],
    choices: () => [
      { label: '受明封号，合兵抗清', desc: '改奉明室，号忠贞营；可与明军互为援应，但须听明朝号令。', apply: s => {
        const court = courtOf(s)!;
        defectFaction(s, 'shun', court);
        s.factions.shun.name = '忠贞营';
        s.factions.shun.loyalty = 55;
        setStance(s, 'shun', 'qing', 'war');
        return '大顺余部改奉明室，号忠贞营。';
      } },
      { label: '议和而不受封', desc: '与明停战，各守其地，仍以大顺为号。', apply: s => { setStance(s, 'shun', courtOf(s)!, 'truce', s.turn + 24); return '与明议和，停战两年。'; } },
    ],
    effect: s => { adjustAtt(s, 'duyinxi', 'loyalty', 3, '促成联合'); adjustAtt(s, 'liguo', 'hawk', 5, '联明抗清'); },
  }),

  /* ---------------- 丙戌（1646） ---------------- */
  ev({
    id: 'ss_zhilong', kind: 'shishi', title: '郑芝龙降清', from: T(1646, 8), to: T(1646, 12), node: 'anping',
    cond: s => alive(s, 'zhengzhilong') && !s.factions.zheng?.defunct && s.factions.zheng.leader === 'zhengzhilong' && topOf(s, 'zheng') !== 'qing'
      && (['fuzhou', 'jianning', 'yanping', 'xianxia', 'quzhou'].some(n => qingHolds(s, n)) || Object.values(s.armies).some(a => topOf(s, a.faction) === 'qing' && NODE[a.location]?.area === '福建')),
    text: () => '清军入闽，博洛许郑芝龙以闽粤总督之位。郑芝龙不顾郑成功苦谏，北上降清，随即被挟往北京。郑成功哭别其父，率部入海。',
    history: '丙戌十一月郑芝龙降清，被博洛挟往北京；郑成功拒不从降，在南澳募兵，后据厦门、金门抗清。',
    source: SRC + '第十章；《台湾外记》',
    chooser: ['zheng'],
    choices: s => [
      { label: '随郑成功起兵（延续抗清一支）', desc: '郑芝龙北上，余部归附清朝；你改领郑成功部，据中左所抗清。', apply: st => { zhengSplit(st, true); return '郑成功起兵抗清。'; } },
      { label: '随郑芝龙归清（延续降清一支）', desc: '郑家奉清，保全安平、泉州的家业；郑成功率部入海，另立一支。', apply: st => { zhengSplit(st, false); return '郑家归附清朝。'; } },
      ...(s.chars.zhengzhilong.att.hawk > 0 || s.chars.zhengzhilong.att.surrender < 40 ? [{ label: '父子同心，拒不降清', desc: '郑芝龙不北上，郑家仍奉明室。清军将全力来攻。', apply: (st: GameState) => { adjustAtt(st, 'zhengzhilong', 'hawk', 20, '拒降'); adjustAtt(st, 'zhengsen', 'loyalty', 10, '父子同心'); return '郑芝龙拒降。'; } }] : []),
    ],
    effect: () => {},
  }),
  ev({
    id: 'ss_tingzhou', kind: 'shishi', title: '汀州之变', from: T(1646, 7), to: T(1646, 10), node: 'tingzhou',
    involves: s => (s.chars.zhuyujian && !Object.values(s.cities).some(c => c.id === s.chars.zhuyujian.location && topOf(s, c.controller) === topOf(s, s.chars.zhuyujian.faction)) ? [] : [s.chars.zhuyujian?.faction ?? '']),
    cond: s => courtLeader(s) === 'zhuyujian' && ['fuzhou', 'yanping', 'jianning'].some(n => qingHolds(s, n)),
    text: () => '清军入闽，隆武帝自延平出奔，行至汀州为清军追及，殉国。',
    history: '丙戌八月，隆武帝在汀州被清军所执，旋死。',
    source: SRC + '第十章',
    effect: s => { captureChar(s, 'zhuyujian', 'qing', '出奔汀州'); s.chars.zhuyujian.status = 'dead'; },
  }),
  ev({
    id: 'ss_yongli', kind: 'shishi', title: '永历即位肇庆', from: T(1646, 9), to: T(1647, 6), node: 'zhaoqing',
    cond: s => courtLeader(s) === 'zhuyoulang',
    text: s => `桂王朱由榔在${nodeName(s.factions[courtOf(s)!].capital)}即位，改元永历。瞿式耜、丁魁楚等辅政。明室正统转入两广。`,
    history: '丙戌十月，朱由榔在肇庆称监国，十一月即位，改元永历；同时苏观生在广州拥立绍武帝，两家相攻。',
    source: SRC + '第十一章',
    effect: s => { adjustAtt(s, 'qushisi', 'loyalty', 5, '辅立永历'); adjustAtt(s, 'dingkuichu', 'surrender', 10, '首鼠两端'); },
  }),
  ev({
    id: 'ss_xianzhong_end', kind: 'shishi', title: '张献忠死于西充', from: T(1646, 11), to: T(1647, 2), node: 'shunqing',
    cond: s => alive(s, 'zhangxianzhong') && s.player !== 'xi' && (['hanzhong', 'baoning', 'shunqing'].some(n => qingHolds(s, n)) || Object.values(s.armies).some(a => topOf(s, a.faction) === 'qing' && NODE[a.location]?.area === '四川')),
    text: () => '清肃亲王豪格率军入川，张献忠在西充凤凰山中箭身亡。孙可望、李定国、刘文秀、艾能奇率大西余部南走贵州。',
    history: '丙戌十一月二十七日（1647 年 1 月 2 日），张献忠在西充凤凰山被清军射杀。',
    source: SRC + '第十二章',
    effect: s => {
      s.chars.zhangxianzhong.status = 'dead';
      for (const a of Object.values(s.armies)) if (a.commander === 'zhangxianzhong') a.commander = alive(s, 'sunkewang') ? 'sunkewang' : a.commander;
      if (alive(s, 'sunkewang')) s.factions.xi.leader = 'sunkewang'; else succession(s, 'xi', '张献忠战死');
      s.factions.xi.name = '大西余部';
      s.flags.xi_south = s.turn;
      for (const a of armiesOf(s, 'xi')) a.morale = Math.max(15, a.morale - 15);
    },
  }),
  /* ---------------- 丁亥—己丑（1647—1649） ---------------- */
  ev({
    id: 'ss_kewang_dian', kind: 'shishi', title: '孙可望入滇', from: T(1647, 3), to: T(1647, 10), node: 'kunming',
    involves: ['xi'],
    cond: s => !s.factions.xi?.defunct && s.flags.xi_south !== undefined,
    text: () => '大西余部经贵州入云南，平定沙定洲之乱，据有滇中。孙可望整饬军纪，劝课农桑，云南渐成抗清根本。',
    history: '丁亥年，孙可望等入滇，击败沙定洲，经营云南，“滇人大悦”。',
    source: SRC + '第十二章',
    effect: s => {
      s.factions.xi.capital = citiesOf(s, 'xi').find(c => NODE[c.id].area === '云贵')?.id ?? s.factions.xi.capital;
      for (const c of citiesOf(s, 'xi')) bump(s, c.id, 'order', 6, '孙可望整饬吏治', { kind: 'event', ref: 'ss_kewang_dian' });
    },
  }),
  ev({
    id: 'ss_jinshenghuan', kind: 'shishi', title: '金声桓江西反正', from: T(1648, 1), to: T(1648, 3), node: 'nanchang',
    cond: s => alive(s, 'jinshenghuan') && (topOf(s, s.player) !== 'qing' || s.chars.jinshenghuan.att.loyalty < 50) && topOf(s, s.chars.jinshenghuan.faction) === 'qing' && qingHolds(s, 'nanchang') && !!courtOf(s),
    text: () => '降清总兵金声桓不满清廷赏薄，与王得仁在南昌反正，奉永历正朔。江西大震。',
    history: '戊子正月，金声桓、王得仁据南昌反正；次年正月南昌城破，金声桓投水死。',
    source: SRC + '第十四章',
    effect: s => revolt(s, 'nanchang', mingSide(s)!, 'jinshenghuan', 40000),
  }),
  ev({
    id: 'ss_lichengdong', kind: 'shishi', title: '李成栋广东反正', from: T(1648, 4), to: T(1648, 6), node: 'guangzhou',
    cond: s => alive(s, 'lichengdong') && (topOf(s, s.player) !== 'qing' || s.chars.lichengdong.att.loyalty < 50) && topOf(s, s.chars.lichengdong.faction) === 'qing' && qingHolds(s, 'guangzhou') && !!courtOf(s),
    text: () => '清两广提督李成栋在广州剪辫反正，迎永历帝。广东全省一时复归明室。',
    history: '戊子四月，李成栋在广州反正，迎永历帝驻肇庆；次年三月兵败信丰，溺水死。',
    source: SRC + '第十四章',
    effect: s => {
      revolt(s, 'guangzhou', mingSide(s)!, 'lichengdong', 50000);
      for (const n of ['zhaoqing', 'huizhougd', 'shaozhou', 'gaozhou']) if (qingHolds(s, n) && s.cities[n].garrison < 6000) { s.cities[n].controller = mingSide(s)!; report(s, { cat: '易主', act: 'revolt', from: 'qing', to: mingSide(s)!, node: n, text: `${nodeName(n)}随李成栋反正。` }); }
    },
  }),
  ev({
    id: 'ss_jiangxiang', kind: 'shishi', title: '姜瓖大同反正', from: T(1648, 12), to: T(1649, 3), node: 'datong',
    cond: s => alive(s, 'jiangxiang') && (topOf(s, s.player) !== 'qing' || s.chars.jiangxiang.att.loyalty < 50) && qingHolds(s, 'datong'),
    text: () => '大同总兵姜瓖易帜反清，山西、陕北各地纷纷响应。清廷震动，多尔衮亲征。',
    history: '戊子十二月，姜瓖在大同反清，晋陕一带响应者众；己丑八月大同城破。',
    source: '《清史稿·姜瓖传》；' + SRC,
    effect: s => {
      const f = splitFaction(s, s.chars.jiangxiang.faction, { id: 'jiang', name: '姜瓖部', short: '姜', color: '#7a5c8f', leader: 'jiangxiang', cities: [], armies: [], chars: ['jiangxiang'], polity: 'ming', doctrine: '据大同反清，响应者遍及晋陕。' });
      f.playable = false;
      delete f.overlord;
      setStance(s, 'jiang', 'qing', 'war');
      revolt(s, 'datong', 'jiang', 'jiangxiang', 30000);
      s.factions.jiang.capital = 'datong';
    },
  }),
  ev({
    id: 'ss_hetengjiao', kind: 'shishi', title: '何腾蛟殉于湘潭', from: T(1649, 1), to: T(1649, 3), node: 'changsha',
    involves: s => (s.chars.hetengjiao && qingHolds(s, s.chars.hetengjiao.location) ? [] : [s.chars.hetengjiao?.faction ?? '']),
    cond: s => alive(s, 'hetengjiao') && ['changsha', 'hengzhou', 'baoqing'].some(n => qingHolds(s, n)),
    text: () => '明督师何腾蛟在湘潭被清军所执，不屈而死。湖南明军群龙无首。',
    history: '己丑正月，何腾蛟在湘潭被清军俘获，绝食七日后遇害。',
    source: SRC + '第十五章',
    effect: s => { captureChar(s, 'hetengjiao', 'qing', '在湘潭'); s.chars.hetengjiao.status = 'dead'; },
  }),
  /* ---------------- 庚寅—壬辰（1650—1652） ---------------- */
  ev({
    id: 'ss_qushisi', kind: 'shishi', title: '瞿式耜殉桂林', from: T(1650, 10), to: T(1651, 2), node: 'guilin',
    involves: s => (s.chars.qushisi && qingHolds(s, s.chars.qushisi.location) ? [] : [s.chars.qushisi?.faction ?? '']),
    cond: s => alive(s, 'qushisi') && qingHolds(s, 'guilin'),
    text: () => '清定南王孔有德攻破桂林，留守瞿式耜与总督张同敞从容就义。',
    history: '庚寅十一月，孔有德破桂林，瞿式耜、张同敞被执不屈，同遇害。',
    source: SRC + '第十七章',
    effect: s => { s.chars.qushisi.status = 'dead'; for (const c of Object.values(s.chars)) if (c.status === 'active' && s.factions[c.faction]?.polity === 'ming') adjustAtt(s, c.id, 'hawk', 2, '闻瞿式耜殉节'); },
  }),
  ev({
    id: 'ss_dorgon', kind: 'shishi', title: '多尔衮卒', from: T(1650, 12), to: T(1651, 1), node: 'beijing',
    cond: s => alive(s, 'duoergun'),
    text: () => '摄政王多尔衮出猎喀喇城，病卒。顺治帝亲政，旋追夺多尔衮封号。清廷内部清算，南方用兵稍缓。',
    history: '顺治七年十二月初九，多尔衮卒于喀喇城；次年二月被追论罪状。',
    source: '《清史稿·睿忠亲王传》',
    effect: s => {
      s.chars.duoergun.status = 'dead';
      for (const a of Object.values(s.armies)) if (a.commander === 'duoergun') a.commander = 'jierhalang';
      if (s.factions.qing.leader === 'duoergun') s.factions.qing.leader = alive(s, 'fulin') ? 'fulin' : 'jierhalang';
      s.chars.fulin.ab = { tong: 40, zheng: 60, mou: 55, wai: 50, wang: 80 };
      for (const a of armiesOf(s, 'qing')) a.morale = Math.max(20, a.morale - 5);
    },
  }),
  ev({
    id: 'ss_kewang_ming', kind: 'shishi', title: '孙可望联明', from: T(1651, 1), to: T(1652, 3), node: 'guiyang',
    cond: s => !s.factions.xi?.defunct && !!courtOf(s) && topOf(s, 'xi') !== topOf(s, courtOf(s)!) && hostile(s, 'qing', 'xi'),
    text: () => '孙可望遣使至永历朝，求封秦王。几经争执，大西余部终与明室合流，迎永历帝至贵州安隆。',
    history: '辛卯年孙可望受封秦王；壬辰二月，永历帝移驻安隆所，由大西军护卫。',
    source: SRC + '第十八章',
    chooser: ['xi'],
    choices: () => [
      { label: '奉永历，联明抗清', desc: '与明室结盟，合兵出湖南、广西；李定国、刘文秀可放手东征。', apply: s => { setStance(s, 'xi', courtOf(s)!, 'alliance'); s.flags.xi_ming = s.turn; for (const id of ['lidingguo', 'liuwenxiu']) adjustAtt(s, id, 'hawk', 10, '联明抗清'); return '大西余部与明室结盟。'; } },
      { label: '自守滇黔', desc: '与明议和而不合兵，休养生息。', apply: s => { setStance(s, 'xi', courtOf(s)!, 'truce', s.turn + 24); return '与明议和。'; } },
    ],
    effect: () => {},
  }),
  ev({
    id: 'ss_guilin_victory', kind: 'shishi', title: '桂林大捷', from: T(1652, 5), to: T(1652, 9), node: 'guilin',
    involves: ['qing', 'xi'],
    cond: s => s.flags.xi_ming !== undefined && alive(s, 'lidingguo') && qingHolds(s, 'guilin') && !s.factions.xi?.defunct,
    text: () => '李定国出湖南，下全州，直捣桂林。清定南王孔有德兵败，阖门自焚。两广震动，“天下震动”。',
    history: '壬辰七月四日，李定国攻克桂林，孔有德自焚死。',
    source: SRC + '第十九章',
    effect: s => {
      if (alive(s, 'kongyoude')) s.chars.kongyoude.status = 'dead';
      revolt(s, 'guilin', 'xi', 'lidingguo', 50000);
      adjustAtt(s, 'lidingguo', 'hawk', 10, '桂林大捷');
      for (const a of Object.values(s.armies)) if (topOf(s, a.faction) === 'qing' && ['广西', '湖广', '广东'].includes(NODE[a.location]?.area)) a.morale = Math.max(15, a.morale - 12);
    },
  }),
  ev({
    id: 'ss_hengyang', kind: 'shishi', title: '衡州斩尼堪', from: T(1652, 10), to: T(1653, 1), node: 'hengzhou',
    involves: ['qing', 'xi'],
    cond: s => s.flags.xi_ming !== undefined && alive(s, 'lidingguo') && alive(s, 'nikan'),
    text: () => '清敬谨亲王尼堪率军南下，在衡州中李定国伏兵，阵亡。李定国“两蹶名王”，声威大振。',
    history: '壬辰十一月二十三日，尼堪在衡州战死。',
    source: SRC + '第十九章',
    effect: s => {
      s.chars.nikan.status = 'dead';
      for (const a of Object.values(s.armies)) if (a.commander === 'nikan') a.commander = alive(s, 'boluo') ? 'boluo' : a.commander;
      for (const a of armiesOf(s, 'qing')) a.morale = Math.max(15, a.morale - 8);
      adjustAtt(s, 'sunkewang', 'loyalty', -8, '忌李定国功高');
    },
  }),
  /* ---------------- 丁酉—己亥（1657—1659） ---------------- */
  ev({
    id: 'ss_kewang_defect', kind: 'shishi', title: '孙可望降清', from: T(1657, 9), to: T(1657, 12), node: 'guiyang',
    cond: s => alive(s, 'sunkewang') && s.factions.xi?.leader === 'sunkewang' && s.flags.xi_ming !== undefined && alive(s, 'lidingguo'),
    text: () => '孙可望与李定国争权，举兵内犯，兵败交水，众叛亲离，率残部降清。云南虚实尽为清廷所知。',
    history: '丁酉九月交水之战，孙可望大败，十一月降清，受封义王。',
    source: SRC + '第二十二章',
    chooser: ['xi'],
    choices: () => [
      { label: '孙可望率部降清（延续李定国一支）', desc: '孙可望出走降清；你改由李定国统领余部，继续抗清。', apply: s => { kewangDefect(s); return '孙可望降清，李定国统领余部。'; } },
      { label: '与李定国和解', desc: '孙、李握手言和，大西余部仍奉明室。孙可望威望受损。', apply: s => { adjustAtt(s, 'sunkewang', 'hawk', 10, '与李定国和解'); adjustAtt(s, 'lidingguo', 'loyalty', 5, '孙、李和解'); return '孙、李和解。'; } },
    ],
    effect: () => {},
  }),
  ev({
    id: 'ss_three_routes', kind: 'shishi', title: '清军三路入滇', from: T(1658, 2), to: T(1658, 12), node: 'guiyang',
    involves: ['qing'],
    cond: s => ['guiyang', 'zunyi', 'chenzhou', 'liuzhou', 'chongqing'].some(n => qingHolds(s, n)) && citiesOf(s, 'qing').length > 60,
    text: () => '清廷以吴三桂、洛托、卓布泰分兵三路，自四川、湖南、广西会攻贵州、云南。',
    history: '戊戌年清军三路入黔，十二月会师，次年正月入昆明。',
    source: SRC + '第二十三章',
    effect: s => { s.flags.qing_yunnan = s.turn; for (const a of armiesOf(s, 'qing')) a.morale = Math.min(95, a.morale + 8); },
  }),
  ev({
    id: 'ss_burma', kind: 'shishi', title: '永历入缅', from: T(1659, 1), to: T(1659, 6), node: 'yongchang',
    involves: ['qing'],
    cond: s => courtLeader(s) === 'zhuyoulang' && qingHolds(s, 'kunming'),
    text: () => '清军入昆明，永历帝西走永昌，渡怒江入缅甸。李定国转战滇西，磨盘山一战，清军伤亡甚重。',
    history: '己亥正月清军入昆明；闰正月永历帝入缅；二月磨盘山之战。',
    source: SRC + '第二十三章',
    effect: s => { adjustAtt(s, 'lidingguo', 'hawk', 5, '磨盘山设伏'); for (const a of armiesOf(s, 'qing')) if (NODE[a.location]?.area === '云贵') a.troops = Math.round(a.troops * 0.85); },
  }),
  ev({
    id: 'ss_north_exp', kind: 'shishi', title: '郑成功北伐南京', from: T(1659, 5), to: T(1659, 8), node: 'zhenjiang',
    cond: s => { const z = zhengAnti(s); return !!z && armiesOf(s, z).some(a => a.mix.navy >= 0.3 && a.troops >= 15000); },
    text: () => '郑成功、张煌言统水陆大军入长江，克瓜洲、镇江，围南京。江南各府县纷纷来归。',
    history: '己亥六月郑军克镇江，七月围南京；郑成功轻敌，七月二十三日大败于南京城下，退回厦门。',
    source: SRC + '第二十四章',
    chooser: ['zheng', 'zhengcg'],
    choices: () => [
      { label: '大举北伐', desc: '水师精锐入江，直取镇江、南京。胜则江南震动，败则元气大伤。', apply: s => { launchNorth(s); return '郑军大举北伐。'; } },
      { label: '经营海上', desc: '不入长江，整顿船队、通商海外，府库充实。', apply: s => { const z = zhengAnti(s)!; const c = s.cities[s.factions[z].capital]; if (c) bump(s, c.id, 'silver', 150000, '经营海上', { kind: 'event', ref: 'ss_north_exp' }); return '郑氏经营海上。'; } },
    ],
    effect: () => {},
  }),
  /* ---------------- 庚子—壬寅（1660—1662） ---------------- */
  ev({
    id: 'ss_shunzhi_end', kind: 'shishi', title: '顺治崩，康熙即位', from: T(1661, 1), to: T(1661, 2), node: 'beijing',
    cond: s => alive(s, 'fulin'),
    text: () => '顺治帝病逝，皇三子玄烨即位，改元康熙，索尼、苏克萨哈、遏必隆、鳌拜四大臣辅政。',
    history: '顺治十八年正月初七，福临卒，玄烨即位。',
    source: '《清史稿·世祖本纪》',
    effect: s => {
      s.chars.fulin.status = 'dead';
      const xy = s.chars.xuanye;
      if (xy) { xy.status = 'active'; xy.faction = 'qing'; xy.location = 'beijing'; delete xy.appear; }
      if (s.factions.qing.leader === 'fulin') s.factions.qing.leader = xy ? 'xuanye' : s.factions.qing.leader;
    },
  }),
  ev({
    id: 'ss_jierhalang_end', kind: 'shishi', title: '济尔哈朗卒', from: T(1655, 5), to: T(1655, 6), node: 'beijing',
    cond: s => alive(s, 'jierhalang'),
    text: () => '郑亲王济尔哈朗病卒。清廷宗室元老凋零，顺治帝独掌朝政。',
    history: '顺治十二年五月，济尔哈朗卒，谥献。',
    source: '《清史稿·郑献亲王济尔哈朗传》',
    effect: s => {
      s.chars.jierhalang.status = 'dead';
      for (const a of Object.values(s.armies)) if (a.commander === 'jierhalang') handover(s, a);
      for (const c of Object.values(s.cities)) if (c.governor === 'jierhalang') c.governor = undefined;
      if (s.factions.qing.leader === 'jierhalang') s.factions.qing.leader = alive(s, 'fulin') ? 'fulin' : s.factions.qing.leader;
    },
  }),
  ev({
    id: 'xs_qianjie', kind: 'xiansuo', title: '迁界令', from: T(1661, 8), to: T(1661, 8), node: 'xiamen',
    text: () => '清廷下令沿海居民内迁三十至五十里，片板不许下海，以断郑氏接济。沿海村落尽成废墟。',
    history: '顺治十八年八月，清廷颁迁界令，自山东至广东沿海居民内迁。',
    source: SRC + '第二十五章',
    chooser: ['qing'],
    choices: () => [
      { label: '颁迁界令', desc: '沿海清属港口商业 −20、民心 −8、海贸减半，以断郑氏接济。（史实）', apply: s2 => { qianjie(s2); return '沿海居民内迁。'; } },
      { label: '不迁界，严守海口', desc: '沿海民生无损；郑氏仍可从沿海得到接济。', apply: () => '沿海如旧。' },
    ],
  }),
  ev({
    id: 'ss_taiwan', kind: 'shishi', title: '东征台湾', from: T(1661, 3), to: T(1662, 1), node: 'dayuan',
    cond: s => { const z = zhengAnti(s); return !!z && ctrl(s, 'dayuan') === 'helan' && armiesOf(s, z).some(a => a.mix.navy >= 0.3 && a.troops >= 8000); },
    text: () => '郑成功率舰队自金门出发，经澎湖，由鹿耳门入台江，围荷兰人所筑热兰遮城。',
    history: '辛丑四月郑军登陆台湾，十二月荷兰长官揆一投降，次年二月交城。',
    source: '《台湾外记》；' + SRC,
    chooser: ['zheng', 'zhengcg'],
    choices: () => [
      { label: '东征台湾', desc: '与荷兰人开战，取大员为根本之地。', apply: s => { launchTaiwan(s); return '郑军东征台湾。'; } },
      { label: '暂不东征', desc: '仍以金、厦为根本。', apply: () => '暂不东征。' },
    ],
    effect: () => {},
  }),
  ev({
    id: 'ss_yongli_end', kind: 'shishi', title: '永历帝蒙难', from: T(1661, 7), to: T(1662, 6), node: 'kunming',
    involves: s => (s.chars.zhuyoulang && !Object.values(s.cities).some(c => c.id === s.chars.zhuyoulang.location && topOf(s, c.controller) === topOf(s, s.chars.zhuyoulang.faction)) ? [] : [s.chars.zhuyoulang?.faction ?? '']),
    cond: s => courtLeader(s) === 'zhuyoulang' && qingHolds(s, 'kunming') && citiesOf(s, courtOf(s)!).length <= 3,
    text: () => '缅甸发生政变，新王将永历帝交给吴三桂。永历帝被押回昆明，以弓弦绞死于篦子坡。',
    history: '辛丑七月咒水之难；十二月缅人献永历帝于吴三桂；壬寅四月永历帝遇害。',
    source: SRC + '第二十五章',
    effect: s => { captureChar(s, 'zhuyoulang', 'qing', '在缅甸'); s.chars.zhuyoulang.status = 'dead'; },
  }),
  ev({
    id: 'ss_koxinga_end', kind: 'shishi', title: '郑成功卒于台湾', from: T(1662, 5), to: T(1662, 6), node: 'dayuan',
    cond: s => alive(s, 'zhengsen') && s.player !== s.chars.zhengsen.faction,
    text: () => '郑成功在台湾病逝，年三十九。郑经嗣位，据台湾、金厦，奉永历正朔。',
    history: '壬寅五月初八，郑成功卒于台湾。',
    source: '《台湾外记》',
    effect: s => {
      const f = s.chars.zhengsen.faction;
      s.chars.zhengsen.status = 'dead';
      for (const a of Object.values(s.armies)) if (a.commander === 'zhengsen') a.commander = alive(s, 'zhengjing') ? 'zhengjing' : a.commander;
      if (s.factions[f]?.leader === 'zhengsen') { if (alive(s, 'zhengjing')) s.factions[f].leader = 'zhengjing'; else succession(s, f, '郑成功病逝'); }
    },
  }),
  ev({
    id: 'ss_dingguo_end', kind: 'shishi', title: '李定国卒于勐腊', from: T(1662, 6), to: T(1662, 8), node: 'yongchang',
    cond: s => alive(s, 'lidingguo') && s.chars.zhuyoulang?.status === 'dead' && s.player !== s.chars.lidingguo.faction,
    text: () => '李定国闻永历帝遇害，悲愤成疾，卒于勐腊，遗命子孙“宁死荒外，勿降也”。',
    history: '壬寅六月，李定国卒于景线（勐腊）。',
    source: SRC + '第二十五章',
    effect: s => { s.chars.lidingguo.status = 'dead'; for (const a of Object.values(s.armies)) if (a.commander === 'lidingguo') succession(s, a.faction, '李定国病逝'); },
  }),

  /* ---------------- 线索 ---------------- */
  ev({
    id: 'xs_huangdaozhou', kind: 'xiansuo', title: '黄道周出关', from: T(1645, 9), to: T(1645, 9), node: 'fuzhou',
    text: () => '隆武朝大学士黄道周不满郑氏拥兵不出，自募书生、乡兵数千出仙霞关，北图徽州。',
    history: '乙酉九月黄道周自募兵出关，十二月兵败婺源被执，次年三月在南京就义。',
    source: SRC + '第七章',
    effect: s => { adjustAtt(s, 'huangdaozhou', 'hawk', 10, '自募兵出关'); adjustAtt(s, 'zhengzhilong', 'loyalty', -3, '为清议所讥'); },
  }),
  ev({
    id: 'xs_kuidong', kind: 'xiansuo', title: '夔东十三家', from: T(1650, 6), to: T(1650, 6), node: 'kuizhou',
    text: () => '大顺余部李来亨、刘体纯、郝摇旗、袁宗第等转入川鄂交界的夔东山区，屯田自守，号“夔东十三家”，坚持抗清。',
    history: '夔东十三家坚持到康熙三年（1664）茅麓山失陷。',
    source: SRC + '第二十六章',
    effect: s => { for (const id of ['lilaiheng', 'liutichun', 'haoyaoqi', 'yuanzongdi']) adjustAtt(s, id, 'hawk', 8, '屯守夔东'); },
  }),
  ev({
    id: 'xs_kongde_guilin', kind: 'xiansuo', title: '三王南下', from: T(1649, 5), to: T(1649, 5), node: 'beijing',
    text: () => '清廷改封孔有德为定南王、耿仲明为靖南王、尚可喜为平南王，令率旧部南征广西、广东。',
    history: '顺治六年五月，清廷命三王南征两广。',
    source: '《清史稿·孔有德传》',
    effect: s => { for (const id of ['kongyoude', 'gengzhongming', 'shangkexi']) adjustAtt(s, id, 'hawk', 8, '受命南征'); },
  }),
  ev({
    id: 'xs_shunzhi_rule', kind: 'xiansuo', title: '顺治亲政', from: T(1651, 2), to: T(1651, 2), node: 'beijing',
    involves: ['qing'],
    text: () => '顺治帝亲政，重用汉官，整顿吏治，蠲免钱粮，北方渐趋安定。',
    history: '顺治八年正月，福临亲政。',
    source: '《清史稿·世祖本纪》',
    effect: s => { for (const c of Object.values(s.cities)) if (qingHolds(s, c.id) && ['北直隶', '山东', '山西', '河南'].includes(NODE[c.id].area)) bump(s, c.id, 'minxin', 3, '蠲免钱粮', { kind: 'event', ref: 'xs_shunzhi_rule' }); },
  }),
];

/** 郑氏抗清的一支（郑成功部或未降之郑氏） */
function zhengAnti(s: GameState): string | null {
  for (const id of ['zhengcg', 'zheng']) { const f = s.factions[id]; if (f && !f.defunct && topOf(s, id) !== 'qing') return id; }
  return null;
}

/** 郑氏分裂：郑芝龙降清北上，郑成功率部入海 */
function zhengSplit(s: GameState, playerFollowsChenggong: boolean) {
  // 郑成功只带走郑氏实际握有的港口：厦门在郑氏手里就据厦门，否则取郑氏所余的一处港口；别家占着的城不白给
  const zPorts = citiesOf(s, 'zheng').map(c => c.id).filter(n => NODE[n].kind === 'port');
  const other = zPorts.find(n => n !== s.factions.zheng.capital);
  const keep = zPorts.includes('xiamen') ? ['xiamen'] : other ? [other] : [];
  const ships = armiesOf(s, 'zheng').filter(a => a.mix.navy >= 0.3).map(a => a.id);
  const fleet = ships.length ? [ships[0]] : [];
  const chars = ['zhengsen', 'ganhui', 'shilang', 'zhenghongkui', 'zhengcai', 'zhengjing'].filter(id => s.chars[id] && s.chars[id].status !== 'dead');
  for (const a of fleet) s.armies[a].commander = alive(s, 'zhengsen') ? 'zhengsen' : s.armies[a].commander;
  const cg = splitFaction(s, 'zheng', { id: 'zhengcg', name: '郑成功部', short: '成', color: '#1f6f8b', leader: alive(s, 'zhengsen') ? 'zhengsen' : chars[0], cities: keep, armies: fleet, chars, polity: 'ming', capital: keep[0] ?? 'xiamen', doctrine: '据金、厦抗清，以海上贸易养兵。' });
  if (courtOf(s)) { cg.overlord = courtOf(s)!; cg.loyalty = 75; }
  setStance(s, 'zhengcg', 'qing', 'war');
  if (!keep.length) {
    // 无港可据：厦门若无人或在郑氏手中则入据，若为他家所占则只率船队入海
    const c = s.cities.xiamen;
    if (c && (c.controller === 'zheng' || c.controller === 'local')) { c.controller = 'zhengcg'; c.governor = undefined; }
    else if (fleet.length) cg.capital = s.armies[fleet[0]].location;
  }
  // 郑芝龙一支归清，芝龙本人被挟北上
  defectFaction(s, 'zheng', 'qing');
  s.factions.zheng.name = '郑氏（降清）';
  captureChar(s, 'zhengzhilong', 'qing', '北上降清');
  const heir = ['zhenghongkui', 'zhengcai'].find(id => alive(s, id) && s.chars[id].faction === 'zheng') ?? Object.values(s.chars).find(c => c.faction === 'zheng' && c.status === 'active')?.id;
  if (heir) s.factions.zheng.leader = heir;
  setStance(s, 'zheng', 'zhengcg', 'war');
  if (s.player === 'zheng' && playerFollowsChenggong) s.player = 'zhengcg';
  report(s, { cat: '易主', act: 'revolt', from: 'zheng', to: 'zhengcg', urgent: true, node: 'xiamen', text: `郑氏分裂：郑芝龙降清北上，郑成功率部据中左所抗清。${s.player === 'zhengcg' ? '你统领郑成功部。' : ''}` });
}

/** 孙可望降清：孙出走，大西余部由李定国统领 */
function kewangDefect(s: GameState) {
  const mine = armiesOf(s, 'xi').filter(a => a.commander === 'sunkewang');
  for (const a of mine) { a.troops = Math.round(a.troops * 0.3); a.faction = 'qing'; }
  s.chars.sunkewang.faction = 'qing';
  s.chars.sunkewang.title = '义王';
  if (alive(s, 'lidingguo')) s.factions.xi.leader = 'lidingguo';
  s.factions.xi.name = '李定国部';
  for (const a of armiesOf(s, 'xi')) a.morale = Math.max(15, a.morale - 10);
}

function launchNorth(s: GameState) {
  const z = zhengAnti(s);
  if (!z) return;
  const fleet = armiesOf(s, z).filter(a => a.mix.navy >= 0.3).sort((a, b) => b.troops - a.troops)[0];
  if (!fleet) return;
  fleet.morale = Math.min(95, fleet.morale + 10);
  if (stance(s, z, 'qing') !== 'war') setStance(s, z, 'qing', 'war');
  setArmyOrder(s, fleet, { kind: 'move', target: 'zhenjiang', attack: true });
  if (alive(s, 'zhanghuangyan')) adjustAtt(s, 'zhanghuangyan', 'hawk', 5, '会师北伐');
}

function launchTaiwan(s: GameState) {
  const z = zhengAnti(s);
  if (!z) return;
  setStance(s, z, 'helan', 'war');
  const fleet = armiesOf(s, z).filter(a => a.mix.navy >= 0.3).sort((a, b) => b.troops - a.troops)[0];
  if (fleet) setArmyOrder(s, fleet, { kind: 'move', target: 'dayuan', attack: true });
}


/** 剃发令的后果：严令则江南新附各城民心大降、明臣同仇；缓行则只小有波动 */
function tifaApply(s: GameState, strict: 0 | 1) {
  s.flags.tifa_strict = strict;
  for (const c of Object.values(s.cities)) {
    if (!qingHolds(s, c.id) || !['南直隶', '浙江'].includes(NODE[c.id].area)) continue;
    bump(s, c.id, 'minxin', strict ? -8 : -2, strict ? '剃发令' : '剃发令暂缓', { kind: 'event', ref: 'ss_tifa' });
  }
  if (strict) for (const ch of Object.values(s.chars)) if (ch.status === 'active' && s.factions[ch.faction]?.polity === 'ming') adjustAtt(s, ch.id, 'hawk', 5, '闻剃发令');
}

/** 鲁王监国：浙东诸城另立一家 */
function luSplit(s: GameState) {
      const court = courtOf(s)!;
      const east = ['shaoxing', 'ningbo', 'taizhou', 'zhoushan', 'wenzhou', 'chuzhouzj'].filter(n => s.factions[ctrl(s, n) ?? '']?.polity === 'ming' && topOf(s, ctrl(s, n)!) === court && ctrl(s, n) !== 'zheng');
      if (!east.length) return;
      const lu = splitFaction(s, ctrl(s, east[0])!, { id: 'lu', name: '鲁监国', short: '鲁', color: '#a0522d', leader: 'zhuyihai', cities: east, armies: [], chars: ['zhuyihai', 'zhanghuangyan', 'zhangmingzhen', 'zhangguowei'].filter(id => alive(s, id)), polity: 'ming', capital: east.includes('shaoxing') ? 'shaoxing' : east[0], doctrine: '凭钱塘江守浙东，与福建朝廷争正统。' });
      lu.playable = false;
      s.chars.zhuyihai.title = '监国';
      setStance(s, 'lu', court, 'neutral');
      setStance(s, 'lu', 'qing', 'war');
      for (const n of east) if (s.cities[n].governor && s.chars[s.cities[n].governor!]?.faction !== 'lu') s.cities[n].governor = undefined;
}

/** 迁界：沿海清属港口内迁 */
function qianjie(s: GameState) {
      for (const c of Object.values(s.cities)) {
        if (!qingHolds(s, c.id) || !['port'].includes(NODE[c.id].kind) || !['福建', '广东', '浙江', '南直隶', '山东'].includes(NODE[c.id].area)) continue;
        bump(s, c.id, 'commerce', -20, '迁界', { kind: 'event', ref: 'xs_qianjie' });
        bump(s, c.id, 'minxin', -8, '迁界', { kind: 'event', ref: 'xs_qianjie' });
        if (c.trade) c.trade = Math.round(c.trade * 50) / 100;
      }
}
