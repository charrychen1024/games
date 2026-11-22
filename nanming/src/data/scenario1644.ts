/* 开局：甲申年五月（1644 年 6 月），朱由崧即位于南京之后。
 * 数值为游戏化近似；uncertain 字段标注归属待考或争夺中的城池。 */
import type { Army, City, GameState, Policy, TroopMix } from '../core/types';
import { CHARACTERS } from './characters';
import { FACTIONS } from './factions';
import { NODES } from './geography';
import { setArmyOrder } from '../core/military';

// [控制者, 人口(万), 农, 商, 文教, 城防, 驻军, 仓粮, 府库, 民心, 吏治, 主官, 海贸]
type Row = [string, number, number, number, number, number, number, number, number, number, number, string?, number?];
const CITY_ROWS: Record<string, Row> = {
  nanjing: ['hongguang', 120, 70, 85, 90, 85, 40000, 300000, 300000, 60, 50, 'zhaozhilong'],
  zhenjiang: ['hongguang', 45, 70, 70, 70, 70, 6000, 60000, 40000, 62, 55],
  guazhou: ['hongguang', 3, 40, 60, 30, 40, 2000, 8000, 5000, 55, 50],
  yangzhou: ['hongguang', 80, 65, 90, 80, 75, 10000, 120000, 120000, 58, 55, 'liuzhaoji'],
  yizhen: ['hongguang', 10, 50, 70, 50, 50, 3000, 20000, 15000, 58, 55],
  huaian: ['liuzeqing', 75, 60, 65, 60, 70, 6000, 80000, 50000, 45, 40, 'liuzeqing'],
  xuzhou: ['gaojie', 60, 50, 45, 40, 70, 6000, 90000, 20000, 45, 40, 'libenshen'],
  sizhou: ['hongguang', 20, 55, 40, 40, 50, 3000, 30000, 10000, 52, 50],
  fengyang: ['liuliangzuo', 55, 45, 35, 40, 60, 5000, 30000, 12000, 42, 40, 'liuliangzuo'],
  shouzhou: ['liuliangzuo', 35, 55, 40, 40, 60, 4000, 30000, 10000, 45, 40],
  luzhou: ['huangdegong', 60, 60, 45, 50, 65, 5000, 50000, 20000, 55, 50, 'huangdegong'],
  chuzhou: ['hongguang', 15, 55, 45, 50, 50, 3000, 25000, 10000, 56, 52],
  hezhou: ['hongguang', 12, 55, 45, 45, 45, 2000, 20000, 8000, 56, 52],
  taiping: ['hongguang', 25, 65, 60, 60, 60, 4000, 40000, 25000, 60, 55],
  wuhu: ['hongguang', 15, 50, 80, 50, 45, 3000, 30000, 30000, 60, 55],
  anqing: ['hongguang', 35, 60, 55, 60, 75, 8000, 50000, 25000, 55, 52],
  chizhou: ['hongguang', 20, 55, 50, 50, 50, 3000, 25000, 12000, 58, 52],
  ningguo: ['hongguang', 25, 60, 55, 60, 50, 3000, 35000, 18000, 60, 55],
  huizhou: ['hongguang', 35, 45, 85, 85, 50, 3000, 30000, 60000, 62, 58],
  changzhou: ['hongguang', 60, 75, 75, 80, 60, 4000, 80000, 50000, 62, 55],
  suzhou: ['hongguang', 110, 80, 95, 95, 65, 5000, 150000, 150000, 60, 52],
  songjiang: ['hongguang', 70, 75, 85, 80, 55, 3000, 100000, 70000, 60, 52],
  hangzhou: ['hongguang', 90, 75, 85, 85, 65, 6000, 120000, 100000, 62, 55, 'zhangguowei'],
  shaoxing: ['hongguang', 60, 70, 70, 85, 50, 3000, 70000, 40000, 62, 55],
  ningbo: ['hongguang', 40, 60, 75, 70, 55, 4000, 50000, 40000, 60, 55, undefined, 0.8],
  quzhou: ['hongguang', 25, 55, 50, 55, 55, 3000, 30000, 12000, 60, 55],
  wenzhou: ['hongguang', 30, 55, 60, 55, 50, 3000, 35000, 20000, 60, 55, undefined, 0.6],
  xianxia: ['hongguang', 1, 20, 10, 10, 85, 2000, 8000, 2000, 55, 50],
  jiujiang: ['hongguang', 30, 55, 65, 55, 70, 15000, 60000, 25000, 55, 52, 'yuanjixian'],
  nanchang: ['mingprov', 70, 70, 60, 70, 65, 6000, 90000, 40000, 58, 52],
  wuchang: ['zuoliangyu', 110, 60, 70, 60, 75, 8000, 180000, 40000, 40, 40, 'zuoliangyu'],
  yuezhou: ['zuoliangyu', 60, 60, 45, 45, 55, 4000, 35000, 12000, 45, 42],
  jingzhou: ['shun', 40, 65, 50, 50, 70, 8000, 50000, 20000, 40, 40],
  xiangyang: ['shun', 35, 55, 50, 45, 80, 10000, 40000, 15000, 42, 42, 'baiwang'],
  fuzhou: ['mingprov', 60, 60, 70, 70, 65, 6000, 60000, 40000, 60, 55, 'zhangkentang'],
  jianning: ['mingprov', 25, 55, 45, 55, 50, 2000, 25000, 10000, 60, 55],
  yanping: ['mingprov', 20, 50, 45, 50, 60, 2000, 20000, 8000, 60, 55],
  quanzhou: ['zheng', 40, 50, 85, 65, 55, 5000, 40000, 60000, 60, 55, undefined, 1.5],
  anping: ['zheng', 8, 30, 90, 30, 50, 6000, 60000, 80000, 70, 60, 'zhengzhilong', 2.0],
  xiamen: ['zheng', 5, 30, 85, 30, 50, 5000, 20000, 50000, 65, 58, 'zhengcai', 1.5],
  zhangzhou: ['zheng', 35, 60, 70, 55, 50, 4000, 40000, 30000, 60, 55, undefined, 1.0],
  guide: ['local', 25, 45, 35, 35, 55, 3000, 20000, 6000, 45, 35],
  suizhou: ['local', 12, 40, 30, 30, 45, 3000, 15000, 4000, 45, 35],
  kaifeng: ['local', 15, 25, 20, 30, 40, 2000, 10000, 3000, 35, 30],
  beijing: ['qing', 100, 50, 70, 80, 95, 30000, 200000, 100000, 40, 50, 'hongchengchou'],
  tianjin: ['qing', 20, 40, 60, 30, 60, 5000, 50000, 20000, 45, 45],
  daming: ['local', 120, 50, 40, 40, 40, 5000, 80000, 20000, 40, 35],
  jinan: ['local', 200, 50, 45, 55, 50, 8000, 100000, 30000, 42, 35],
  taiyuan: ['shun', 150, 45, 45, 45, 70, 15000, 80000, 30000, 40, 40],
  xian: ['shun', 150, 45, 45, 45, 80, 20000, 100000, 40000, 50, 45, 'niujinxing'],
  tongguan: ['shun', 2, 20, 10, 10, 95, 15000, 30000, 5000, 50, 45],
  hanzhong: ['shun', 40, 55, 30, 30, 60, 5000, 30000, 8000, 45, 40],
  lanzhou: ['shun', 60, 35, 30, 25, 55, 5000, 30000, 8000, 45, 40],
  luoyang: ['shun', 60, 35, 30, 40, 55, 4000, 20000, 6000, 40, 35],
  nanyang: ['local', 50, 40, 30, 30, 50, 3000, 20000, 5000, 40, 35],
  chengdu: ['mingprov', 200, 75, 55, 60, 70, 15000, 150000, 60000, 50, 45],
  chongqing: ['mingprov', 80, 60, 45, 40, 70, 10000, 60000, 20000, 50, 45, 'zengying'],
  kuizhou: ['xi', 30, 40, 30, 25, 50, 3000, 20000, 5000, 35, 30],
  changsha: ['mingprov', 200, 65, 45, 50, 55, 10000, 120000, 40000, 55, 50, 'hetengjiao'],
  ganzhou: ['mingprov', 80, 55, 45, 40, 60, 6000, 50000, 15000, 55, 50],
  guangzhou: ['mingprov', 250, 65, 80, 55, 65, 15000, 150000, 100000, 58, 50, undefined, 1.5],
  guilin: ['mingprov', 120, 55, 40, 40, 60, 8000, 60000, 20000, 58, 52, 'qushisi'],
  guiyang: ['mingprov', 60, 40, 25, 25, 55, 5000, 30000, 8000, 52, 48],
  kunming: ['mingprov', 150, 55, 40, 45, 65, 15000, 80000, 30000, 58, 52, 'mutianbo'],
  shanhai: ['qing', 2, 20, 10, 10, 95, 10000, 30000, 5000, 50, 50],
  shengjing: ['qing', 60, 40, 30, 20, 70, 10000, 80000, 30000, 60, 55],
};

const UNCERTAIN: Record<string, string> = {
  jinan: '五六月间大顺官吏被逐，山东由士绅团练自守，清军尚未接收。',
  daming: '北直隶南部各府县归属未定，部分已向清投诚。',
  guide: '河南东部明、顺、地方武装犬牙交错。',
  suizhou: '许定国等地方武装盘踞，向背不定。',
  kaifeng: '城毁于崇祯十五年决河，此时近乎空城。',
  nanyang: '大顺撤退后由地方自守。',
  luoyang: '大顺守将尚在，人心浮动。',
  jingzhou: '大顺于湖广北部仍设官守，具体控制范围待考。',
};

const mix = (inf: number, cav: number, gun: number, navy: number): TroopMix => ({ inf, cav, gun, navy });
const A = (id: string, name: string, faction: string, commander: string, troops: number, m: TroopMix, location: string, supply: string, morale = 65): Army =>
  ({ id, name, faction, commander, troops, mix: m, morale, location, path: [], progress: 0, order: { kind: 'hold' }, supply, hunger: 0 });

export const ARMIES_1644: Army[] = [
  A('a_shi', '督师标营', 'hongguang', 'shikefa', 8000, mix(0.6, 0.15, 0.25, 0), 'nanjing', 'nanjing', 68),
  A('a_gao', '高杰本部', 'gaojie', 'gaojie', 40000, mix(0.55, 0.35, 0.1, 0), 'yangzhou', 'xuzhou', 70),
  A('a_lzq', '刘泽清部', 'liuzeqing', 'liuzeqing', 20000, mix(0.65, 0.2, 0.1, 0.05), 'huaian', 'huaian', 55),
  A('a_llz', '刘良佐部', 'liuliangzuo', 'liuliangzuo', 20000, mix(0.6, 0.3, 0.1, 0), 'fengyang', 'fengyang', 58),
  A('a_huang', '黄得功部', 'huangdegong', 'huangdegong', 30000, mix(0.55, 0.3, 0.15, 0), 'luzhou', 'luzhou', 75),
  A('a_zuo', '左良玉本部', 'zuoliangyu', 'zuoliangyu', 60000, mix(0.6, 0.2, 0.1, 0.1), 'wuchang', 'wuchang', 55),
  A('a_zhk', '镇江水师', 'zheng', 'zhenghongkui', 8000, mix(0.3, 0, 0.2, 0.5), 'zhenjiang', 'zhenjiang', 65),
  A('a_zzl', '郑氏船队', 'zheng', 'zhengzhilong', 20000, mix(0.3, 0, 0.2, 0.5), 'anping', 'quanzhou', 70),
  A('a_duoduo', '豫亲王军', 'qing', 'duoduo', 50000, mix(0.35, 0.5, 0.15, 0), 'beijing', 'beijing', 82),
  A('a_ajige', '英亲王军', 'qing', 'ajige', 40000, mix(0.35, 0.55, 0.1, 0), 'beijing', 'beijing', 80),
  A('a_wu', '关宁军', 'qing', 'wusangui', 30000, mix(0.5, 0.35, 0.15, 0), 'beijing', 'beijing', 75),
  A('a_zhunta', '山东路清军', 'qing', 'zhunta', 15000, mix(0.4, 0.5, 0.1, 0), 'tianjin', 'tianjin', 78),
  A('a_li', '大顺御营', 'shun', 'lizicheng', 50000, mix(0.55, 0.35, 0.1, 0), 'taiyuan', 'taiyuan', 42),
  A('a_liguo', '李过部', 'shun', 'liguo', 30000, mix(0.6, 0.3, 0.1, 0), 'xian', 'xian', 52),
  A('a_bai', '襄阳顺军', 'shun', 'baiwang', 15000, mix(0.65, 0.25, 0.1, 0), 'xiangyang', 'xiangyang', 55),
  A('a_zhang', '西营本部', 'xi', 'zhangxianzhong', 80000, mix(0.65, 0.2, 0.1, 0.05), 'kuizhou', 'kuizhou', 72),
];

export function createState1644(seed = 1644): GameState {
  const cities: Record<string, City> = {};
  for (const n of NODES) {
    if (n.kind === 'outland') continue;
    const r = CITY_ROWS[n.id];
    if (!r) throw new Error('missing city row: ' + n.id);
    const [controller, pop, agri, commerce, edu, wall, garrison, grain, silver, minxin, order, governor, trade] = r;
    cities[n.id] = {
      id: n.id, controller, pop, agri, commerce, edu, wall, garrison, grain, silver, minxin, order,
      policy: 'balanced' as Policy, governor, trade, uncertain: UNCERTAIN[n.id],
    };
  }
  const relations: GameState['relations'] = {};
  const set = (a: string, b: string, stance: GameState['relations'][string]['stance']) => { relations[[a, b].sort().join('|')] = { stance }; };
  set('hongguang', 'shun', 'war');
  set('hongguang', 'xi', 'war');
  set('qing', 'shun', 'war');
  set('hongguang', 'qing', 'neutral');
  set('qing', 'xi', 'neutral');
  set('shun', 'xi', 'neutral');
  for (const f of FACTIONS) if (f.id !== 'local') set('local', f.id, 'war');

  const state: GameState = {
    version: 1,
    scenario: '1644',
    turn: 0,
    seed,
    player: 'hongguang',
    factions: Object.fromEntries(FACTIONS.map(f => [f.id, structuredClone(f)])),
    relations,
    chars: Object.fromEntries(CHARACTERS.map(c => [c.id, structuredClone(c)])),
    cities,
    armies: Object.fromEntries(ARMIES_1644.map(a => [a.id, structuredClone(a)])),
    sieges: {},
    missions: [],
    delayed: [],
    ledger: [],
    reports: [],
    events: [],
    battles: [],
    flags: {},
    nextId: 1,
  };
  // 李自成正自山西撤回关中
  setArmyOrder(state, state.armies.a_li, { kind: 'move', target: 'xian', attack: false });
  return state;
}
