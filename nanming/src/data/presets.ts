/* 预设局面：地图样稿与验收测试共用。 */
import type { GameState } from '../core/types';
import { createState1644 } from './scenario1644';
import { turnOf } from '../core/calendar';
import { setStance } from '../core/state';
import { defectFaction } from '../core/military';

/** 弘光开局十二回合试玩 */
export function trialState(seed = 1644): GameState {
  const s = createState1644(seed);
  s.turnLimit = 12;
  s.scenario = 'trial';
  return s;
}

/** 样稿局面：乙酉四月，清军围扬州。用于地图样稿与“读档后围城继续”的验收。 */
export function yangzhouSiegeState(seed = 1645): GameState {
  const s = createState1644(seed);
  s.scenario = 'yangzhou';
  s.turn = turnOf(1645, 4);
  s.flags.qing_south = turnOf(1644, 10);
  setStance(s, 'qing', 'hongguang', 'war');
  // 江北局势：徐州、泗州、淮安已失，刘良佐已归附清朝，高杰已死
  for (const id of ['xuzhou', 'sizhou', 'guide', 'suizhou', 'kaifeng', 'daming', 'jinan', 'taiyuan', 'tongguan', 'xian', 'luoyang']) { s.cities[id].controller = 'qing'; s.cities[id].governor = undefined; }
  s.cities.huaian.controller = 'liuzeqing';
  defectFaction(s, 'liuliangzuo', 'qing');
  s.chars.liuliangzuo.att.loyalty = 70;
  s.chars.gaojie.status = 'dead';
  s.factions.gaojie.leader = 'libenshen';
  s.cities.xuzhou.garrison = 6000;
  for (const id of ['xian', 'tongguan', 'luoyang']) s.cities[id].garrison = 8000;
  // 李自成南走，大顺余部在襄阳一带
  s.armies.a_li.location = 'xiangyang'; s.armies.a_li.path = []; s.armies.a_li.progress = 0; s.armies.a_li.order = { kind: 'hold' }; s.armies.a_li.supply = 'xiangyang';
  s.armies.a_liguo.location = 'jingzhou'; s.armies.a_liguo.supply = 'jingzhou';
  s.chars.lizicheng.location = 'xiangyang';
  // 张献忠已据四川
  for (const id of ['chongqing', 'chengdu']) s.cities[id].controller = 'xi';
  s.armies.a_zhang.location = 'chengdu'; s.armies.a_zhang.supply = 'chengdu';
  s.factions.xi.name = '大西'; s.factions.xi.capital = 'chengdu';
  // 扬州：史可法督师守城
  const yz = s.cities.yangzhou;
  yz.garrison = 24000; yz.wall = 78; yz.minxin = 62; yz.grain = 90000; yz.governor = 'shikefa';
  s.chars.shikefa.location = 'yangzhou'; s.chars.shikefa.title = '督师 · 东阁大学士';
  delete s.armies.a_shi;
  s.chars.liuzhaoji.location = 'yangzhou';
  // 高杰旧部李本深在瓜洲观望
  const gao = s.armies.a_gao; gao.commander = 'libenshen'; gao.location = 'guazhou'; gao.troops = 25000; gao.morale = 40; gao.name = '高部旧营';
  s.chars.libenshen.location = 'guazhou';
  // 黄得功西御左良玉，驻芜湖
  s.armies.a_huang.location = 'wuhu';
  s.armies.a_zuo.location = 'jiujiang'; delete s.factions.zuoliangyu.overlord; setStance(s, 'zuoliangyu', 'hongguang', 'war');
  s.cities.jiujiang.controller = 'zuoliangyu'; s.cities.jiujiang.governor = undefined; s.chars.yuanjixian.location = 'anqing';
  s.flags.zuo_rebel = turnOf(1645, 3);
  // 左良玉四月初病死九江，左梦庚继统：人物、势力、军队与军报一致
  s.chars.zuoliangyu.status = 'dead';
  s.factions.zuoliangyu.leader = 'zuomenggeng';
  s.factions.zuoliangyu.name = '左梦庚部';
  s.armies.a_zuo.commander = 'zuomenggeng'; s.armies.a_zuo.name = '左部大营';
  s.chars.zuomenggeng.location = 'jiujiang';
  // 清军：多铎主力围扬州，准塔在淮安城外
  const dd = s.armies.a_duoduo; dd.location = 'yangzhou'; dd.troops = 68000; dd.morale = 80; dd.supply = 'sizhou'; dd.order = { kind: 'siege', target: 'yangzhou', assault: true };
  s.chars.duoduo.location = 'yangzhou';
  s.armies.a_kong = { id: 'a_kong', name: '汉军火器营', faction: 'qing', commander: 'haoge', troops: 18000, mix: { inf: 0.4, cav: 0.2, gun: 0.4, navy: 0 }, morale: 75,
    location: 'yangzhou', path: [], progress: 0, order: { kind: 'siege', target: 'yangzhou', assault: true }, supply: 'xuzhou', hunger: 0 };
  s.chars.haoge.location = 'yangzhou';
  s.cities.sizhou.grain = 160000; s.cities.xuzhou.grain = 120000;
  const zt = s.armies.a_zhunta; zt.location = 'huaian'; zt.troops = 15000; zt.supply = 'xuzhou'; zt.order = { kind: 'hold' };
  s.armies.a_ajige.location = 'xian'; s.armies.a_ajige.supply = 'xian';
  s.armies.a_wu.location = 'xian'; s.armies.a_wu.supply = 'xian';
  s.sieges.yangzhou = { node: 'yangzhou', attacker: 'qing', armies: ['a_duoduo', 'a_kong'], startTurn: s.turn - 1, months: 1 };
  s.flags.sieged_yangzhou = s.turn - 1;
  for (const id of ['xuzhou', 'sizhou', 'guide', 'suizhou', 'kaifeng']) s.flags['lost_how_' + id] = '陷城';
  s.events = ['xs_jiashen', 'xs_tifa1', 'ss_dushi', 'ss_gaojie_yz', 'xs_shandong', 'ss_mashiying', 'ss_zheng_feng', 'ss_chongqing', 'xs_shun_west', 'ss_letter', 'xs_fushe', 'xs_haimao', 'ss_tuqiao', 'ss_chengdu',
    'xs_huaiyang', 'xs_liuzeqing', 'ss_qing_south', 'ss_daxi', 'xs_xuanshunv', 'ss_tongguan', 'ss_gaojie_killed', 'xs_sanan', 'ss_zuo_east', 'ss_duoduo_huai'].map(id => ({ id, turn: 0, variant: 'history' as const }));
  s.reports.push({ turn: s.turn - 1, cat: '急报', urgent: true, node: 'yangzhou', text: '清豫亲王多铎兵临扬州城下，督师史可法闭城固守。守军 2.4 万，城防 78。', src: { kind: 'siege', ref: 'yangzhou' } });
  s.reports.push({ turn: s.turn - 1, cat: '易主', node: 'sizhou', text: '泗州易主（陷城）：清军渡淮，攻破泗州。现由清控制。' });
  s.reports.push({ turn: s.turn - 1, cat: '易主', node: 'fengyang', text: '刘良佐率刘良佐部正式归附清朝。凤阳、寿州一体改奉清朝，实控者不变。' });
  s.reports.push({ turn: s.turn - 1, cat: '军报', node: 'jiujiang', text: '左良玉部占九江，左良玉病死军中，其子左梦庚继统。' });
  s.turnLimit = s.turn + 2;
  return s;
}
