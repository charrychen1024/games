/* 首年史事与线索（甲申五月—乙酉四月）。日期按农历登记，来源附于每条。
 * 主要参考：顾诚《南明史》、计六奇《明季南略》、《明史》诸传、徐鼒《小腆纪年附考》。具体日期待考据人员逐条核对。 */
import type { EventDef } from '../core/events';
import type { GameState } from '../core/types';
import { turnOf } from '../core/calendar';
import { adjustAtt, adjustLoyalty, bump, setStance, hostile, report, armiesOf } from '../core/state';
import { setArmyOrder, captureChar, succession } from '../core/military';
import { shortestPath, NODE } from './geography';
import { LATE_EVENTS } from './events-late';

const T = (y: number, m: number) => turnOf(y, m);
const alive = (s: GameState, id: string) => s.chars[id]?.status === 'active';
const ctrl = (s: GameState, node: string) => s.cities[node]?.controller;
const armyNear = (s: GameState, faction: string, nodes: string[]) => Object.values(s.armies).some(a => a.faction === faction && nodes.includes(a.location));
const SRC_GU = '顾诚《南明史》';

export const EVENTS: EventDef[] = [
  /* ---------------- 线索 ---------------- */
  {
    id: 'xs_jiashen', kind: 'xiansuo', title: '甲申之变', from: 0, to: 0, node: 'beijing',
    text: () => '三月十九日，大顺军破北京，崇祯帝自缢于煤山。四月，吴三桂开山海关引清兵，大顺军败于一片石，清军入北京。消息传到南京，江南震动。',
    history: '崇祯十七年三月十九日北京陷落；四月二十二日山海关之战；五月初二清军入北京。',
    source: SRC_GU + '第一章',
    effect: s => { adjustAtt(s, 'shikefa', 'hawk', 5, '闻国变'); adjustAtt(s, 'zhengsen', 'hawk', 5, '闻国变'); },
  },
  {
    id: 'xs_tifa1', kind: 'xiansuo', title: '清廷初颁剃发令', from: 0, to: 0, node: 'beijing',
    text: () => '清军入京之初，即令降官军民剃发易服，北方士民骚然。月余之后，多尔衮暂缓此令，以安人心。',
    history: '顺治元年五月初颁剃发令，五月二十四日因民情汹汹而暂停，至次年六月复行。',
    source: SRC_GU + '第二章',
    effect: s => { for (const id of ['jinan', 'daming']) bump(s, id, 'minxin', -2, '剃发令传闻', { kind: 'event', ref: 'xs_tifa1' }); adjustAtt(s, 'qianqianyi', 'surrender', -3, '闻剃发令'); },
  },
  {
    id: 'xs_shandong', kind: 'xiansuo', title: '山东士绅逐大顺官吏', from: 1, to: 1, node: 'jinan',
    text: s => `大顺所设地方官被山东、北直隶士绅团练驱逐，地方处于无主状态。${ctrl(s, 'jinan') === 'local' ? '谁先派官接收，谁便能得到这一大片地方。' : ''}`,
    history: '甲申五六月间，山东、北直隶多地士绅杀逐大顺官员，多数随即向清投诚；弘光朝廷经略山东迟缓。',
    source: SRC_GU + '第二章',
    effect: s => { adjustAtt(s, 'shikefa', 'hawk', 3, '闻山东无主，欲经略中原'); },
  },
  {
    id: 'xs_fushe', kind: 'xiansuo', title: '阮大铖与复社', from: 3, to: 3, node: 'nanjing',
    text: () => '阮大铖起用之后，与当年具名《留都防乱公揭》的复社诸生积怨难解，朝中门户之争愈烈，东林、复社人士多不自安。',
    history: '崇祯十一年复社诸生发《留都防乱公揭》驱逐阮大铖；弘光朝阮大铖复起，大兴党狱。',
    source: SRC_GU + '第三章',
    effect: s => {
      bump(s, 'nanjing', 'order', -3, '党争', { kind: 'event', ref: 'xs_fushe' });
      adjustAtt(s, 'qianqianyi', 'loyalty', -4, '党争日烈');
      adjustAtt(s, 'zuoliangyu', 'loyalty', -3, '东林旧人受排挤');
      adjustAtt(s, 'ruandacheng', 'loyalty', 3, '得势');
    },
  },
  {
    id: 'xs_haimao', kind: 'xiansuo', title: '郑氏海上贸易', from: 3, to: 3, node: 'anping',
    text: () => '郑芝龙的船队往来日本、吕宋与东南沿海，凡海舶须持郑氏令旗方能通行。郑家富甲东南，朝廷亦倚之为海上屏障。',
    history: '郑芝龙受抚后垄断闽海贸易，“海舶不得郑氏令旗不能往来”。',
    source: '《台湾外记》；' + SRC_GU,
    effect: s => { bump(s, 'anping', 'silver', 20000, '海舶令旗之利', { kind: 'event', ref: 'xs_haimao' }); adjustAtt(s, 'zhengzhilong', 'hawk', -3, '重贸易而轻战'); },
  },
  {
    id: 'xs_huaiyang', kind: 'xiansuo', title: '四镇扰民', from: 4, to: 4, node: 'yangzhou',
    text: () => '江北四镇各据防区，就地征粮派饷，兵民相仇。淮扬一带村落多空。',
    history: '四镇“各占地方，自行征收”，扰害淮扬，民怨甚深。',
    source: '《明季南略》卷一',
    effect: s => { for (const id of ['yangzhou', 'huaian', 'sizhou', 'fengyang', 'luzhou', 'xuzhou']) bump(s, id, 'minxin', -3, '四镇扰民', { kind: 'event', ref: 'xs_huaiyang' }); },
  },
  {
    id: 'xs_liuzeqing', kind: 'xiansuo', title: '刘泽清大治私第', from: 5, to: 5, node: 'huaian',
    text: () => '刘泽清在淮安大兴土木，营建私第，役使兵民，置防务于不顾。',
    history: '刘泽清驻淮安，“大治第宅”，无意进取。',
    source: '《明季南略》',
    effect: s => { adjustAtt(s, 'liuzeqing', 'surrender', 4, '耽于享乐'); adjustAtt(s, 'liuzeqing', 'hawk', -5, '无意进取'); bump(s, 'huaian', 'minxin', -3, '营建私第', { kind: 'event', ref: 'xs_liuzeqing' }); },
  },
  {
    id: 'xs_xuanshunv', kind: 'xiansuo', title: '宫中采选', from: 7, to: 7, node: 'nanjing',
    text: () => '宫中选淑女、采办繁兴，又以各种名目加派。江南士民多有怨言，前线将士则时有欠饷。',
    history: '弘光帝在南京选淑女、修宫殿，用度浩繁，时人多有讥评。',
    source: SRC_GU + '第三章',
    effect: s => { for (const id of ['nanjing', 'suzhou', 'changzhou', 'songjiang']) bump(s, id, 'minxin', -2, '宫中采选', { kind: 'event', ref: 'xs_xuanshunv' }); adjustAtt(s, 'shikefa', 'loyalty', -2, '上疏谏止不听'); },
  },
  {
    id: 'xs_shun_west', kind: 'xiansuo', title: '大顺退守西安', from: 2, to: 2, node: 'xian',
    text: s => `李自成退出北京后经山西撤回关中。${ctrl(s, 'taiyuan') === 'shun' ? '山西尚有顺军，但人心已散。' : '山西已不为大顺所有。'}`,
    history: '甲申五月李自成撤离北京，经山西于秋季回到西安。',
    source: SRC_GU + '第二章',
    effect: s => { adjustAtt(s, 'lizicheng', 'hawk', -5, '新败之余'); adjustAtt(s, 'niujinxing', 'surrender', 5, '大顺势衰'); },
  },
  {
    id: 'xs_sanan', kind: 'xiansuo', title: '南都三案', from: 10, to: 10, node: 'nanjing',
    text: () => '去冬有僧人大悲自称亲王，今春又有“北来太子”与自称福王旧妃的童氏先后到南京。朝廷判为伪冒，朝野议论纷纷，江上诸镇也借此指责马士英。',
    history: '大悲案（甲申十二月）、北来太子案与童妃案（乙酉春），时人多疑朝廷处置不公，左良玉即以“救太子”为起兵名义之一。',
    source: SRC_GU + '第四章',
    effect: s => { adjustAtt(s, 'zuoliangyu', 'loyalty', -8, '借太子案指斥朝廷'); bump(s, 'nanjing', 'minxin', -5, '三案流言', { kind: 'event', ref: 'xs_sanan' }); adjustAtt(s, 'mashiying', 'loyalty', -2, '众矢之的'); },
  },

  /* ---------------- 史事 ---------------- */
  {
    id: 'ss_dushi', kind: 'shishi', title: '史可法督师江北', from: 0, to: 1, node: 'yangzhou',
    cond: s => alive(s, 'shikefa') && s.chars.shikefa.faction === 'hongguang' && ctrl(s, 'yangzhou') === 'hongguang',
    text: () => '马士英入阁掌枢，史可法自请出镇。朝廷设江北四镇：高杰、刘泽清、刘良佐、黄得功各领防区，由史可法以督师之名驻扬州节制。号令能否落实，全在督师与诸将之间。',
    history: '甲申五月，史可法以大学士督师江北，开府扬州；四镇之设出自其议。',
    source: '《明史·史可法传》；' + SRC_GU + '第三章',
    effect: s => {
      s.chars.shikefa.location = 'yangzhou';
      s.chars.shikefa.title = '督师 · 东阁大学士';
      const a = s.armies.a_shi;
      // 玩家已给标营下了别的命令，就不替玩家改
      if (a && (a.faction !== s.player || (a.order.kind === 'hold' && !a.path.length))) setArmyOrder(s, a, { kind: 'move', target: 'yangzhou', attack: false });
      for (const f of ['gaojie', 'liuzeqing', 'liuliangzuo', 'huangdegong']) adjustLoyalty(s, f, 4, '督师调和');
      adjustAtt(s, 'mashiying', 'loyalty', 2, '独揽朝政');
    },
  },
  {
    id: 'ss_gaojie_yz', kind: 'shishi', title: '高杰争扬州', from: 0, to: 2, node: 'yangzhou',
    cond: s => alive(s, 'gaojie') && s.armies.a_gao?.location === 'yangzhou' && ctrl(s, 'yangzhou') === 'hongguang',
    text: () => '高杰兵至扬州，欲携家眷入城。扬州士民闭门拒守，高兵在城外焚掠。双方相持，城中人心惶惶。',
    history: '甲申五六月间，高杰围扬州月余，史可法亲往调解，许其驻瓜洲，后改防徐州。',
    source: '《明史·高杰传》；' + SRC_GU + '第三章',
    effect: s => { bump(s, 'yangzhou', 'minxin', -8, '高兵城外焚掠', { kind: 'event', ref: 'ss_gaojie_yz' }); },
    chooser: ['hongguang'],
    choices: () => [
      { label: '许其驻瓜洲，拨粮安抚', desc: '扬州拨粮两万石给高杰部；高杰服从 +10，扬州民心 +4。', apply: s => {
        bump(s, 'yangzhou', 'grain', -20000, '拨粮安抚高杰', { kind: 'event', ref: 'ss_gaojie_yz' });
        adjustLoyalty(s, 'gaojie', 10, '朝廷许驻瓜洲并拨粮');
        bump(s, 'yangzhou', 'minxin', 4, '高兵退驻瓜洲', { kind: 'event', ref: 'ss_gaojie_yz' });
        const a = s.armies.a_gao; if (a) setArmyOrder(s, a, { kind: 'move', target: 'guazhou', attack: false });
        return '高杰移营瓜洲。';
      } },
      { label: '严令移防徐州', desc: '不给钱粮，责其北上防区。高杰服从 −8，但扬州得以安定（民心 +6）。', apply: s => {
        adjustLoyalty(s, 'gaojie', -8, '朝廷严令移防');
        bump(s, 'yangzhou', 'minxin', 6, '高兵北去', { kind: 'event', ref: 'ss_gaojie_yz' });
        const a = s.armies.a_gao; if (a) setArmyOrder(s, a, { kind: 'move', target: 'xuzhou', attack: false });
        return '高杰怏怏北去。';
      } },
      { label: '听其入城', desc: '高杰服从 +15，但扬州民心 −15，城中富户逃散。', apply: s => {
        adjustLoyalty(s, 'gaojie', 15, '得入扬州');
        bump(s, 'yangzhou', 'minxin', -15, '高兵入城', { kind: 'event', ref: 'ss_gaojie_yz' });
        bump(s, 'yangzhou', 'commerce', -6, '富户逃散', { kind: 'event', ref: 'ss_gaojie_yz' });
        return '高兵入城，扬州人心大坏。';
      } },
    ],
  },
  {
    id: 'ss_mashiying', kind: 'shishi', title: '马士英、阮大铖掌权', from: 1, to: 3, node: 'nanjing',
    cond: s => alive(s, 'mashiying') && s.chars.mashiying.faction === 'hongguang',
    text: () => '马士英以拥立之功独揽朝政，荐阮大铖入兵部。东林旧人相继去位，镇守武昌的左良玉对朝中权臣愈加不满。',
    history: '甲申夏秋，马士英为首辅，阮大铖以兵部右侍郎起用，旋升尚书，朝局为之一变。',
    source: '《明史·奸臣传》；' + SRC_GU + '第三章',
    effect: s => {
      adjustAtt(s, 'zuoliangyu', 'loyalty', -6, '马阮掌权');
      adjustLoyalty(s, 'zuoliangyu', -5, '马阮掌权');
      adjustAtt(s, 'qianqianyi', 'surrender', 4, '仕途失意');
      adjustAtt(s, 'shikefa', 'loyalty', -2, '为权臣所排');
    },
  },
  {
    id: 'ss_zheng_feng', kind: 'shishi', title: '郑芝龙受封', from: 1, to: 4, node: 'anping',
    cond: s => s.factions.zheng?.overlord === 'hongguang' && alive(s, 'zhengzhilong'),
    text: () => '朝廷加封郑芝龙为南安伯，令其弟郑鸿逵率水师守镇江江面。郑家受恩，但仍以海上为根本。',
    history: '弘光朝封郑芝龙为南安伯，郑鸿逵以总兵守镇江。',
    source: '《台湾外记》；' + SRC_GU,
    effect: s => { adjustLoyalty(s, 'zheng', 8, '受封南安伯'); adjustAtt(s, 'zhenghongkui', 'loyalty', 5, '受命守江'); },
  },
  {
    id: 'ss_chongqing', kind: 'shishi', title: '张献忠破重庆', from: 1, to: 3, node: 'chongqing',
    cond: s => ctrl(s, 'chongqing') === 'xi',
    altered: s => ctrl(s, 'chongqing') !== 'xi' && !!s.factions.xi && !s.factions.xi.defunct,
    text: (_s, v) => v === 'history' ? '西营溯江而上，攻破重庆，川东震恐。' : '西营攻重庆不下，在川东徘徊。',
    history: '甲申六月二十日张献忠破重庆。',
    source: SRC_GU + '第六章',
    effect: (s, v) => { if (v === 'history') { adjustAtt(s, 'zengying', 'hawk', 8, '重庆失陷'); bump(s, 'chengdu', 'minxin', -5, '重庆失陷', { kind: 'event', ref: 'ss_chongqing' }); } },
  },
  {
    id: 'ss_letter', kind: 'shishi', title: '多尔衮致书史可法', from: 2, to: 4, node: 'yangzhou',
    cond: s => alive(s, 'shikefa') && !hostile(s, 'qing', 'hongguang'),
    text: () => '清摄政王多尔衮致书史可法：清兵入关是为明朝报君父之仇；南京“擅立”新君，应当削号归藩，“共享富贵”。书至扬州，朝野争论应当如何回应。',
    history: '顺治元年七月多尔衮致书史可法，九月史可法复书，申明大义，拒绝其要求。同期弘光朝廷遣左懋第北上议和。',
    source: '《多尔衮致史可法书》《史可法复多尔衮书》；' + SRC_GU + '第三章',
    effect: s => {
      for (const id of ['qianqianyi', 'zhaozhilong', 'mashiying', 'liuzeqing', 'liuliangzuo']) adjustAtt(s, id, 'surrender', 4, '清廷招降之书');
      adjustAtt(s, 'shikefa', 'hawk', 8, '清廷招降之书');
    },
    chooser: ['hongguang'],
    choices: () => [
      { label: '史可法复书严拒', desc: '申明大义。南京民心 +4，史可法、黄得功主战 +5；清廷将更早南下。', apply: s => {
        bump(s, 'nanjing', 'minxin', 4, '复书申明大义', { kind: 'event', ref: 'ss_letter' });
        adjustAtt(s, 'shikefa', 'hawk', 5, '复书拒清'); adjustAtt(s, 'huangdegong', 'hawk', 5, '复书拒清');
        s.flags.qing_south_at = Math.min(Number(s.flags.qing_south_at ?? 6), 5);
        return '复书传诵江南。';
      } },
      { label: '遣左懋第北上议和', desc: '以银十万两犒清，争取时间：清廷南下推迟两月。左懋第恐被扣留。', apply: s => {
        bump(s, 'nanjing', 'silver', -100000, '北使犒银', { kind: 'event', ref: 'ss_letter' });
        s.flags.qing_south_at = Number(s.flags.qing_south_at ?? 6) + 2;
        s.flags.zuomaodi_mission = s.turn;
        if (s.chars.zuomaodi) s.chars.zuomaodi.location = 'beijing';
        return '左懋第携银北上。';
      } },
    ],
  },
  {
    id: 'ss_tuqiao', kind: 'shishi', title: '土桥之役', from: 3, to: 5, node: 'yizhen',
    // 两部须同在江北、相去不过两站，才谈得上争防地
    cond: s => alive(s, 'gaojie') && alive(s, 'huangdegong') && !!s.armies.a_gao && !!s.armies.a_huang && near(s.armies.a_gao.location, s.armies.a_huang.location, 2),
    text: () => '高杰与黄得功争夺防地，高杰部在仪真土桥伏击黄得功，黄部死伤甚众。两镇几成仇敌。',
    history: '甲申九月，高杰伏兵土桥袭黄得功，史可法居间调停，两镇积怨难解。',
    source: '《明史·黄得功传》；' + SRC_GU + '第三章',
    effect: s => { const a = s.armies.a_huang; if (a) a.troops = Math.max(1000, a.troops - 2000); adjustAtt(s, 'huangdegong', 'loyalty', -3, '朝廷不能约束高杰'); },
    chooser: ['hongguang'],
    choices: () => [
      { label: '出银调停', desc: '南京出银三万两分犒两镇。高、黄服从各 +6。', apply: s => {
        bump(s, 'nanjing', 'silver', -30000, '调停两镇', { kind: 'event', ref: 'ss_tuqiao' });
        adjustLoyalty(s, 'gaojie', 6, '朝廷调停'); adjustLoyalty(s, 'huangdegong', 6, '朝廷调停');
      } },
      { label: '责高杰，抚黄得功', desc: '高杰服从 −8，黄得功服从 +10。', apply: s => { adjustLoyalty(s, 'gaojie', -8, '朝廷责其擅兵'); adjustLoyalty(s, 'huangdegong', 10, '朝廷抚慰'); } },
      { label: '置之不问', desc: '不花钱粮，两镇服从各 −4。', apply: s => { adjustLoyalty(s, 'gaojie', -4, '朝廷不问'); adjustLoyalty(s, 'huangdegong', -4, '朝廷不问'); } },
    ],
  },
  {
    id: 'ss_chengdu', kind: 'shishi', title: '张献忠破成都', from: 3, to: 5, node: 'chengdu',
    cond: s => ctrl(s, 'chengdu') === 'xi',
    altered: s => ctrl(s, 'chengdu') !== 'xi' && ctrl(s, 'chongqing') === 'xi',
    text: (_s, v) => v === 'history' ? '西营破成都，蜀王府被毁，四川大部落入张献忠之手。' : '西营据重庆，攻成都未克，川西明军死守。',
    history: '甲申八月初九张献忠破成都。',
    source: SRC_GU + '第六章',
    effect: (s, v) => { if (v === 'history') adjustAtt(s, 'zhangxianzhong', 'hawk', 5, '得成都'); },
  },
  {
    id: 'ss_qing_south', kind: 'shishi', title: '清廷决意南下', from: 5, to: 8, node: 'beijing',
    cond: s => !hostile(s, 'qing', 'hongguang') && s.turn >= Number(s.flags.qing_south_at ?? 6),
    text: () => '清廷以南京“擅立”、拒不归附为由，命豫亲王多铎统兵南征，英亲王阿济格西击大顺。清与弘光朝廷正式为敌。',
    history: '顺治元年十月，清廷命多铎南下、阿济格西征；多铎先转攻潼关，乙酉二月再自河南南下。',
    source: SRC_GU + '第四章',
    effect: s => {
      setStance(s, 'qing', 'hongguang', 'war');
      s.flags.qing_south = s.turn;
      report(s, { cat: '急报', urgent: true, node: 'beijing', text: '清与弘光朝廷正式为敌。江北各镇须早作防备。' });
      if (s.flags.zuomaodi_mission !== undefined && alive(s, 'zuomaodi')) captureChar(s, 'zuomaodi', 'qing', '北使不屈');
      for (const id of ['liuzeqing', 'liuliangzuo', 'libenshen', 'zhaozhilong', 'qianqianyi']) adjustAtt(s, id, 'surrender', 3, '清兵将至');
    },
  },
  {
    id: 'ss_daxi', kind: 'shishi', title: '大西建国', from: 6, to: 7, node: 'chengdu',
    cond: s => ctrl(s, 'chengdu') === 'xi',
    text: () => '张献忠在成都称帝，国号大西，改元大顺，以成都为西京。',
    history: '甲申十一月十六日张献忠在成都即位，国号大西。',
    source: SRC_GU + '第六章',
    effect: s => { s.flags.daxi = s.turn; s.factions.xi.name = '大西'; s.factions.xi.capital = 'chengdu'; },
  },
  {
    id: 'ss_tongguan', kind: 'shishi', title: '李自成失潼关', from: 7, to: 9, node: 'tongguan',
    cond: s => ctrl(s, 'tongguan') === 'qing',
    altered: s => ctrl(s, 'tongguan') === 'shun',
    text: (s, v) => v === 'history' ? `清军破潼关，${s.chars.lizicheng.status === 'active' ? '李自成' : '大顺余部'}放弃西安，经商洛南走湖广。` : '清军未能叩开潼关，大顺仍据关中，但已显疲态。',
    history: '顺治二年正月，清军克潼关，李自成弃西安南撤。',
    source: SRC_GU + '第四章',
    effect: (s, v) => {
      if (v === 'history') { adjustAtt(s, 'lizicheng', 'hawk', -10, '失潼关'); for (const a of armiesOf(s, 'shun')) a.morale = Math.max(10, a.morale - 10); }
      else adjustAtt(s, 'lizicheng', 'hawk', 5, '守住潼关');
    },
  },
  {
    id: 'ss_gaojie_killed', kind: 'shishi', title: '睢州之变', from: 8, to: 8, node: 'suizhou',
    cond: s => alive(s, 'gaojie') && armyNear(s, 'gaojie', ['suizhou', 'guide']),
    text: () => '高杰北进至睢州，当地总兵许定国设宴，夜间伏兵杀高杰，随后渡河投清。高杰部众无主，军中大乱。',
    history: '乙酉正月十二日，高杰在睢州被许定国诱杀，许定国降清。高部由其外甥李本深等统领，后多降清。',
    source: '《明史·高杰传》；' + SRC_GU + '第四章',
    effect: s => {
      s.chars.gaojie.status = 'dead';
      for (const a of armiesOf(s, 'gaojie')) { a.morale = Math.max(10, a.morale - 25); if (a.commander === 'gaojie') a.commander = 'libenshen'; }
      succession(s, 'gaojie', '高杰遇害');
      adjustLoyalty(s, 'gaojie', -10, '主帅遇害，部众离心');
      if (s.cities.suizhou && s.cities.suizhou.controller === 'local' && hostile(s, 'qing', 'hongguang')) s.cities.suizhou.controller = 'qing';
    },
  },
  {
    id: 'ss_zuo_east', kind: 'shishi', title: '左良玉“清君侧”', from: 10, to: 10, node: 'wuchang',
    cond: s => alive(s, 'zuoliangyu') && s.factions.zuoliangyu?.overlord === 'hongguang' && (s.factions.zuoliangyu.loyalty ?? 50) < 45,
    altered: s => alive(s, 'zuoliangyu') && s.factions.zuoliangyu?.overlord === 'hongguang',
    text: (_s, v) => v === 'history'
      ? '左良玉以“救太子、清君侧、讨马士英”为名，自武昌顺江东下，兵锋直指南京。朝廷不得不抽调江北兵马西援。'
      : '左良玉上疏痛劾马士英，扬言东下。因朝廷事先安抚，左部终未起兵。',
    history: '乙酉三月二十三日左良玉自武昌起兵东下，四月初病死九江，其子左梦庚继统，后降清。朝廷调黄得功等西御，江北空虚。',
    source: '《明史·左良玉传》；' + SRC_GU + '第四章',
    effect: (s, v) => {
      if (v === 'history') {
        const f = s.factions.zuoliangyu;
        delete f.overlord;
        setStance(s, 'zuoliangyu', 'hongguang', 'war');
        s.flags.zuo_rebel = s.turn;
        const a = s.armies.a_zuo; if (a) setArmyOrder(s, a, { kind: 'move', target: 'jiujiang', attack: true });
        report(s, { cat: '急报', urgent: true, node: 'wuchang', text: '左良玉起兵东下。九江、安庆首当其冲。' });
      } else adjustAtt(s, 'zuoliangyu', 'loyalty', -3, '上疏劾马士英');
    },
  },
  {
    id: 'ss_duoduo_huai', kind: 'shishi', title: '多铎渡淮', from: 9, to: 11, node: 'sizhou',
    cond: s => hostile(s, 'qing', 'hongguang') && Object.values(s.armies).some(a => a.faction === 'qing' && ['xuzhou', 'sizhou', 'huaian', 'fengyang', 'guide', 'shouzhou'].includes(a.location)),
    text: () => '清军自河南、山东分路南下，抵淮河一线。江北诸镇人心浮动，有人已暗中遣使输诚。',
    history: '乙酉四月，多铎军渡淮，刘良佐、刘泽清等相继降清或南逃，清军直趋扬州。',
    source: SRC_GU + '第五章',
    effect: s => {
      for (const id of ['liuliangzuo', 'liuzeqing', 'libenshen', 'zhaozhilong', 'qianqianyi', 'zuomenggeng']) adjustAtt(s, id, 'surrender', 10, '清军渡淮');
      adjustAtt(s, 'shikefa', 'hawk', 5, '誓死守土'); adjustAtt(s, 'huangdegong', 'hawk', 5, '誓死守土');
    },
  },
  {
    id: 'ss_yangzhou', kind: 'shishi', title: '扬州之战', from: 11, to: 11, node: 'yangzhou',
    // 史实分支只认强攻陷城；献城、围而未下、解围都按本局实情改写；清军从未到扬州则不发生
    cond: s => ctrl(s, 'yangzhou') === 'qing' && s.flags.lost_how_yangzhou === '陷城',
    altered: s => yzState(s) !== 'none',
    text: (s, v) => {
      const shi = s.chars.shikefa;
      if (v === 'history') {
        const taken = shi && shi.status !== 'active' && String(s.flags.lost_caught_yangzhou ?? '').split(',').includes('shikefa');
        const away = shi && shi.status === 'active' && shi.faction !== 'qing' ? `督师史可法时在${placeName(shi.location)}，不在城中。` : '';
        return `扬州城破。${taken ? '督师史可法被执，不屈而死。' : away}清军入城后连日屠戮，死者无数，史称“扬州十日”。消息传开，江南州县或望风而降，或决意死守。`;
      }
      switch (yzState(s)) {
        case 'surrendered': return `扬州守将开城降清，${shi?.faction === 'qing' ? '史可法随城改投清朝，' : ''}城中免于兵燹。清军不战而得江北重镇，江南为之震动。`;
        case 'besieged': return '清军围扬州。督师史可法誓与城共存亡，城中军民登陴固守。';
        case 'relieved': return `清军围扬州未下，终于解围而去。${ctrl(s, 'yangzhou') === 'qing' ? '' : '扬州犹在明军之手，'}江北人心稍定。`;
        default: return '';
      }
    },
    history: '乙酉四月二十五日扬州城破，史可法殉国；清军屠城十日。五月清军渡江，南京开城投降，弘光帝被俘。',
    source: '王秀楚《扬州十日记》；《明史·史可法传》；' + SRC_GU + '第五章',
    effect: (s, v) => {
      if (v === 'history') {
        for (const id of ['zhaozhilong', 'qianqianyi', 'mashiying', 'liuliangzuo', 'liuzeqing']) adjustAtt(s, id, 'surrender', 12, '扬州屠城，惧祸');
        for (const id of ['zhengsen', 'huangdegong', 'zhangguowei', 'hetengjiao', 'qushisi']) adjustAtt(s, id, 'hawk', 12, '闻扬州屠城');
        for (const id of ['suzhou', 'changzhou', 'songjiang', 'hangzhou', 'shaoxing']) bump(s, id, 'minxin', -5, '扬州屠城，人心惶恐', { kind: 'event', ref: 'ss_yangzhou' });
        if (s.chars.shikefa?.status === 'captured' && String(s.flags.lost_caught_yangzhou ?? '').split(',').includes('shikefa')) s.chars.shikefa.status = 'dead';
      } else {
        const st = yzState(s);
        if (st === 'surrendered') {
          for (const id of ['zhaozhilong', 'qianqianyi', 'liuliangzuo', 'liuzeqing']) adjustAtt(s, id, 'surrender', 6, '扬州开城降清');
          for (const id of ['huangdegong', 'zhangguowei']) adjustAtt(s, id, 'hawk', 4, '耻扬州不战而降');
        } else if (st === 'besieged') {
          adjustAtt(s, 'shikefa', 'hawk', 10, '誓守扬州');
          bump(s, 'yangzhou', 'minxin', 6, '督师誓守，军民同心', { kind: 'event', ref: 'ss_yangzhou' });
        } else if (st === 'relieved') {
          bump(s, 'yangzhou', 'minxin', 8, '扬州解围', { kind: 'event', ref: 'ss_yangzhou' });
          for (const id of ['huangdegong', 'zhengsen', 'shikefa']) adjustAtt(s, id, 'hawk', 5, '扬州解围');
          for (const id of ['liuliangzuo', 'liuzeqing', 'zhaozhilong']) adjustAtt(s, id, 'surrender', -5, '清军受挫于扬州');
        }
      }
    },
  },
  ...LATE_EVENTS,
];

/** 本局扬州的实际处境 */
function yzState(s: GameState): 'surrendered' | 'besieged' | 'relieved' | 'none' {
  const how = s.flags.lost_how_yangzhou;
  if (ctrl(s, 'yangzhou') === 'qing' && how && how !== '陷城') return 'surrendered';
  if (s.sieges.yangzhou && hostile(s, s.sieges.yangzhou.attacker, 'hongguang')) return 'besieged';
  if (s.flags.sieged_yangzhou !== undefined && ctrl(s, 'yangzhou') !== 'qing') return 'relieved';
  return 'none';
}
function near(a: string, b: string, steps: number): boolean {
  if (a === b) return true;
  const p = shortestPath(a, b, false);
  return !!p && p.length <= steps;
}
function placeName(id: string): string { return NODE[id]?.name ?? id; }

/** 某势力在某城附近是否有军队（供调试用） */
export function nearby(s: GameState, faction: string, node: string): boolean {
  return Object.values(s.armies).some(a => a.faction === faction && (a.location === node || shortestPath(a.location, node, false)?.length === 1));
}
export { T };
