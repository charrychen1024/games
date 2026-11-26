/* 开局：甲申年五月（1644 年 6 月），朱由崧即位于南京之后。
 * 数值为游戏化近似；uncertain 字段标注归属待考或争夺中的城池。 */
import type { Army, City, GameState, Policy, TroopMix } from '../core/types';
import { CHARACTERS } from './characters';
import { FACTIONS } from './factions';
import { NODES } from './geography';
import { setArmyOrder } from '../core/military';
import { staffAdmin } from '../core/people';

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
  beijing: ['qing', 100, 50, 70, 80, 95, 30000, 260000, 300000, 40, 50, 'hongchengchou'],
  tianjin: ['qing', 20, 40, 60, 30, 60, 5000, 50000, 20000, 45, 45],
  daming: ['local', 60, 50, 40, 40, 45, 3000, 50000, 12000, 40, 35],
  jinan: ['local', 80, 55, 50, 60, 65, 5000, 70000, 25000, 42, 35],
  taiyuan: ['shun', 70, 45, 50, 45, 75, 10000, 60000, 25000, 40, 40],
  xian: ['shun', 90, 50, 50, 50, 85, 20000, 160000, 260000, 50, 45, 'niujinxing'],
  tongguan: ['shun', 2, 20, 10, 10, 95, 15000, 30000, 5000, 50, 45],
  hanzhong: ['shun', 40, 55, 30, 30, 60, 5000, 30000, 8000, 45, 40],
  lanzhou: ['shun', 35, 35, 30, 25, 60, 4000, 25000, 6000, 45, 40],
  luoyang: ['shun', 40, 35, 30, 40, 55, 4000, 20000, 6000, 40, 35],
  nanyang: ['local', 40, 40, 30, 30, 50, 3000, 20000, 5000, 40, 35],
  chengdu: ['mingprov', 110, 75, 55, 60, 75, 12000, 120000, 50000, 50, 45],
  chongqing: ['mingprov', 60, 60, 50, 40, 75, 8000, 50000, 20000, 50, 45, 'zengying'],
  kuizhou: ['xi', 30, 40, 30, 25, 50, 3000, 90000, 120000, 35, 30],
  changsha: ['mingprov', 80, 70, 50, 55, 60, 8000, 90000, 30000, 55, 50, 'hetengjiao'],
  ganzhou: ['mingprov', 50, 55, 50, 45, 70, 6000, 45000, 15000, 55, 50, 'yangtinglin'],
  guangzhou: ['mingprov', 120, 65, 85, 60, 70, 12000, 120000, 90000, 58, 50, 'chenbangyan', 1.5],
  guilin: ['mingprov', 50, 55, 40, 45, 70, 6000, 45000, 15000, 58, 52, 'qushisi'],
  guiyang: ['mingprov', 25, 40, 25, 25, 60, 4000, 25000, 6000, 52, 48],
  kunming: ['mingprov', 60, 60, 45, 45, 70, 10000, 70000, 25000, 58, 52, 'mutianbo'],
  shanhai: ['qing', 2, 20, 10, 10, 95, 10000, 30000, 5000, 50, 50],
  shengjing: ['qing', 60, 40, 30, 20, 70, 10000, 100000, 120000, 60, 55],
  // ---- 全国 ----
  baoding: ['qing', 45, 50, 40, 45, 70, 5000, 40000, 12000, 42, 45],
  zhending: ['local', 50, 50, 35, 40, 65, 3000, 35000, 8000, 42, 38],
  hejian: ['local', 45, 50, 40, 40, 55, 2500, 35000, 10000, 42, 38],
  shunde: ['local', 30, 50, 35, 35, 50, 2000, 25000, 6000, 42, 38],
  yongping: ['qing', 25, 40, 30, 30, 70, 4000, 30000, 8000, 45, 45],
  xuanfu: ['qing', 15, 30, 25, 20, 85, 6000, 25000, 6000, 45, 45],
  dengzhou: ['local', 30, 45, 55, 45, 70, 3000, 25000, 10000, 45, 40, undefined, 0.5],
  laizhou: ['local', 35, 50, 40, 45, 55, 2000, 30000, 8000, 45, 40],
  qingzhou: ['local', 55, 55, 45, 50, 60, 3000, 45000, 12000, 42, 38],
  yanzhou: ['local', 60, 55, 50, 70, 65, 3000, 50000, 15000, 42, 38],
  dongchang: ['local', 40, 50, 50, 45, 55, 2000, 35000, 10000, 42, 38],
  linqing: ['local', 25, 40, 75, 40, 55, 2000, 30000, 20000, 45, 40],
  datong: ['qing', 25, 30, 30, 25, 90, 12000, 40000, 10000, 40, 40],
  pingyang: ['shun', 60, 50, 45, 45, 60, 5000, 40000, 12000, 40, 38],
  luan: ['shun', 40, 45, 45, 40, 60, 4000, 30000, 10000, 40, 38],
  yanan: ['shun', 25, 35, 25, 25, 60, 5000, 20000, 5000, 52, 42],
  yulin: ['shun', 10, 25, 20, 20, 85, 8000, 20000, 5000, 52, 42],
  ningxia: ['shun', 15, 40, 30, 20, 80, 6000, 25000, 6000, 45, 40],
  fengxiang: ['shun', 35, 50, 35, 35, 60, 4000, 30000, 8000, 48, 42],
  pingliang: ['shun', 30, 40, 30, 30, 60, 4000, 25000, 6000, 45, 40],
  gongchang: ['shun', 30, 40, 25, 25, 55, 3000, 20000, 5000, 45, 40],
  zhangde: ['local', 35, 50, 40, 40, 55, 2500, 30000, 8000, 40, 36],
  weihui: ['local', 30, 50, 40, 40, 50, 2000, 25000, 7000, 40, 36],
  huaiqing: ['shun', 30, 55, 40, 40, 55, 3000, 25000, 7000, 40, 36],
  runing: ['local', 35, 45, 35, 35, 55, 2500, 25000, 6000, 40, 36],
  yunyang: ['mingprov', 15, 35, 25, 25, 70, 4000, 20000, 5000, 50, 45],
  dean: ['shun', 30, 50, 40, 40, 55, 3000, 25000, 7000, 40, 38],
  huangzhou: ['zuoliangyu', 40, 55, 45, 50, 55, 3000, 30000, 10000, 45, 42],
  changde: ['mingprov', 40, 65, 45, 45, 60, 4000, 40000, 12000, 55, 50],
  chenzhou: ['mingprov', 25, 45, 30, 30, 60, 3000, 20000, 6000, 55, 50],
  hengzhou: ['mingprov', 45, 65, 45, 45, 60, 4000, 40000, 12000, 55, 50],
  baoqing: ['mingprov', 35, 60, 35, 35, 55, 3000, 30000, 8000, 55, 50],
  yongzhou: ['mingprov', 30, 55, 35, 35, 55, 3000, 25000, 7000, 55, 50],
  chen: ['mingprov', 20, 45, 35, 30, 55, 2500, 18000, 6000, 55, 50],
  raozhou: ['mingprov', 50, 65, 70, 55, 55, 3000, 45000, 20000, 58, 52],
  guangxin: ['mingprov', 40, 55, 55, 50, 55, 3000, 35000, 15000, 58, 52],
  fuzhoujx: ['mingprov', 45, 65, 50, 70, 55, 3000, 40000, 15000, 58, 52],
  jian: ['mingprov', 55, 65, 50, 75, 55, 3000, 45000, 15000, 58, 52],
  yuanzhou: ['mingprov', 30, 55, 40, 45, 55, 2500, 25000, 8000, 58, 52],
  nanan: ['mingprov', 15, 40, 50, 35, 75, 2500, 15000, 8000, 58, 52],
  huzhou: ['hongguang', 55, 75, 75, 80, 55, 3000, 70000, 40000, 62, 55],
  jiaxing: ['hongguang', 55, 75, 80, 80, 55, 3000, 70000, 45000, 62, 55],
  jinhua: ['hongguang', 40, 60, 55, 70, 60, 3000, 40000, 15000, 62, 55],
  taizhou: ['hongguang', 35, 55, 50, 55, 55, 2500, 30000, 12000, 62, 55, undefined, 0.4],
  chuzhouzj: ['hongguang', 25, 45, 40, 45, 55, 2000, 20000, 6000, 62, 55],
  zhoushan: ['hongguang', 5, 30, 50, 20, 55, 3000, 15000, 8000, 60, 55, undefined, 0.6],
  jiangyin: ['hongguang', 20, 70, 60, 65, 70, 2500, 30000, 15000, 66, 58],
  tingzhou: ['mingprov', 25, 45, 35, 40, 60, 2500, 20000, 6000, 58, 52],
  shaowu: ['mingprov', 20, 45, 35, 40, 65, 2500, 18000, 6000, 58, 52],
  xinghua: ['mingprov', 30, 55, 60, 70, 55, 2500, 25000, 12000, 60, 55, undefined, 0.5],
  shaozhou: ['mingprov', 25, 50, 45, 40, 60, 3000, 25000, 8000, 58, 52],
  zhaoqing: ['mingprov', 40, 60, 55, 50, 65, 5000, 40000, 20000, 58, 52, 'dingkuichu'],
  huizhougd: ['mingprov', 35, 55, 50, 40, 55, 2500, 30000, 10000, 58, 52],
  chaozhou: ['mingprov', 45, 60, 70, 55, 60, 3000, 40000, 20000, 58, 52, undefined, 0.8],
  gaozhou: ['mingprov', 30, 55, 40, 35, 50, 2000, 25000, 8000, 58, 52],
  leizhou: ['mingprov', 20, 50, 40, 30, 50, 2000, 18000, 6000, 58, 52, undefined, 0.3],
  qiongzhou: ['mingprov', 25, 50, 45, 40, 55, 2000, 20000, 8000, 60, 52, undefined, 0.4],
  wuzhou: ['mingprov', 25, 50, 55, 40, 60, 3000, 25000, 10000, 58, 52],
  pingle: ['mingprov', 20, 50, 35, 35, 55, 2000, 18000, 6000, 58, 52],
  liuzhou: ['mingprov', 25, 45, 30, 30, 55, 2500, 20000, 6000, 55, 50],
  nanning: ['mingprov', 25, 50, 40, 35, 55, 2500, 20000, 7000, 55, 50],
  baoning: ['mingprov', 35, 55, 35, 40, 65, 4000, 30000, 8000, 48, 44],
  shunqing: ['mingprov', 40, 65, 40, 40, 55, 3000, 35000, 9000, 48, 44],
  xuzhousc: ['mingprov', 35, 55, 40, 35, 55, 3000, 30000, 8000, 50, 45],
  luzhousc: ['mingprov', 30, 55, 40, 35, 55, 3000, 25000, 8000, 50, 45],
  zunyi: ['mingprov', 20, 45, 30, 25, 65, 3000, 18000, 5000, 50, 45],
  yazhou: ['mingprov', 15, 45, 30, 25, 60, 2500, 15000, 5000, 50, 45],
  zhenyuan: ['mingprov', 15, 40, 30, 25, 60, 2500, 15000, 5000, 52, 48],
  anshun: ['mingprov', 15, 40, 25, 20, 60, 2500, 15000, 4000, 52, 48],
  qujing: ['mingprov', 25, 50, 30, 30, 60, 3000, 20000, 6000, 55, 50],
  chuxiong: ['mingprov', 20, 50, 30, 30, 55, 2500, 18000, 5000, 55, 50],
  dali: ['mingprov', 30, 55, 40, 45, 65, 3000, 25000, 8000, 58, 52],
  yongchang: ['mingprov', 20, 45, 35, 30, 60, 2500, 18000, 6000, 55, 50],
  linan: ['mingprov', 25, 55, 35, 35, 55, 2500, 20000, 6000, 55, 50],
  dayuan: ['helan', 6, 35, 80, 20, 75, 2000, 20000, 60000, 50, 55, undefined, 1.5],
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
  baoding: '清军入京后保定等府相继投诚，具体日期待考。',
  zhending: '大顺官吏被逐，真定一带由地方武装自守。',
  hejian: '河间一带向清投诚与地方自守并存。',
  datong: '姜瓖杀大顺守将，以大同降清。',
  dean: '大顺在湖广北部所设州县，存续时间待考。',
  yunyang: '郧阳明军与大顺犬牙交错，归属待考。',
  huaiqing: '大顺在豫西北仍有守将，人心浮动。',
  zhoushan: '舟山为明军水师据点，后为黄斌卿所据。',
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

/** 完整剧本：自选一家，自甲申五月玩到壬寅年末 */
export function createGame(player: string, seed = 1644): GameState {
  const s = createState1644(seed);
  if (!s.factions[player]?.playable) throw new Error('不可选的势力：' + player);
  s.player = player;
  s.scenario = 'full';
  return s;
}

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
    // 不留值为 undefined 的键：存读档前后字段次序一致，结果逐字相同
    const c = cities[n.id] as unknown as Record<string, unknown>;
    for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
  }
  // 增补人物出任开局主官
  const GOV: Record<string, string> = { suzhou: 'qibiaojia', ningbo: 'wangzhiren', chengdu: 'longwenguang', xuzhousc: 'fanyiheng', zunyi: 'wangyingxiong', taiyuan: 'chenyongfu', hanzhong: 'hezhen', datong: 'jiangxiang' };
  for (const [id, g] of Object.entries(GOV)) if (cities[id] && !cities[id].governor && CHARACTERS.some(c => c.id === g && c.faction === cities[id].controller)) cities[id].governor = g;
  const relations: GameState['relations'] = {};
  const set = (a: string, b: string, stance: GameState['relations'][string]['stance']) => { relations[[a, b].sort().join('|')] = { stance }; };
  set('hongguang', 'shun', 'war');
  set('hongguang', 'xi', 'war');
  set('qing', 'shun', 'war');
  set('hongguang', 'qing', 'neutral');
  set('qing', 'xi', 'neutral');
  set('shun', 'xi', 'neutral');
  for (const f of FACTIONS) if (f.id !== 'local') set('local', f.id, 'war');
  set('local', 'helan', 'neutral');

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
    flags: { ming_court: 'hongguang' },
    nextId: 1,
  };
  // 李自成正自山西撤回关中
  setArmyOrder(state, state.armies.a_li, { kind: 'move', target: 'xian', attack: false });
  staffAdmin(state);
  return state;
}
