/* 政权（朝廷与名号）、势力（实际掌兵掌地的集团）。 */
import type { Faction, Polity } from '../core/types';
import { turnOf } from '../core/calendar';

export const POLITIES: Record<string, Polity> = {
  ming: { id: 'ming', name: '明', mark: '明', flag: 'tri', eras: [
    { name: '崇祯', firstYear: 1628, fromTurn: 0 },
    { name: '弘光', firstYear: 1645, fromTurn: turnOf(1645, 1) },
  ] },
  qing: { id: 'qing', name: '清', mark: '清', flag: 'banner', eras: [{ name: '顺治', firstYear: 1644, fromTurn: 0 }, { name: '康熙', firstYear: 1662, fromTurn: turnOf(1662, 1) }] },
  shun: { id: 'shun', name: '大顺', mark: '顺', flag: 'swallow', eras: [{ name: '永昌', firstYear: 1644, fromTurn: 0 }] },
  xi: { id: 'xi', name: '大西', mark: '西', flag: 'rect', eras: [{ name: '大顺', firstYear: 1644, fromTurn: turnOf(1644, 11) }] },
  helan: { id: 'helan', name: '荷兰', mark: '荷', flag: 'rect', eras: [] },
  none: { id: 'none', name: '无所奉', mark: '', flag: 'rect', eras: [] },
};

export const FACTIONS: Faction[] = [
  { id: 'hongguang', name: '弘光朝廷', short: '弘光', color: '#b5342a', polity: 'ming', leader: 'zhuyousong', capital: 'nanjing', playable: true,
    doctrine: '守江淮，倚四镇屏障江南。' },
  { id: 'gaojie', name: '高杰部', short: '高', color: '#c9783c', polity: 'ming', leader: 'gaojie', capital: 'xuzhou', overlord: 'hongguang', loyalty: 45, playable: false,
    doctrine: '江北四镇之一，兵最强而最难驭，觊觎扬州繁华。' },
  { id: 'liuzeqing', name: '刘泽清部', short: '泽', color: '#c4a050', polity: 'ming', leader: 'liuzeqing', capital: 'huaian', overlord: 'hongguang', loyalty: 38, playable: false,
    doctrine: '江北四镇之一，据淮安，重私利。' },
  { id: 'liuliangzuo', name: '刘良佐部', short: '良', color: '#a26e4c', polity: 'ming', leader: 'liuliangzuo', capital: 'fengyang', overlord: 'hongguang', loyalty: 42, playable: false,
    doctrine: '江北四镇之一，据凤阳、寿州。' },
  { id: 'huangdegong', name: '黄得功部', short: '黄', color: '#d8664e', polity: 'ming', leader: 'huangdegong', capital: 'luzhou', overlord: 'hongguang', loyalty: 82, playable: false,
    doctrine: '江北四镇之一，最称忠勇，与高杰不睦。' },
  { id: 'zuoliangyu', name: '左良玉部', short: '左', color: '#8e4f6e', polity: 'ming', leader: 'zuoliangyu', capital: 'wuchang', overlord: 'hongguang', loyalty: 40, playable: false,
    doctrine: '拥兵武昌，号称八十万，与马士英、阮大铖积怨。' },
  { id: 'mingprov', name: '各省明官府', short: '省', color: '#c98b7c', polity: 'ming', leader: 'hetengjiao', capital: 'changsha', overlord: 'hongguang', loyalty: 70, playable: false, admin: true,
    doctrine: '湖南、江西、两广、云贵、川中与闽北的明朝地方官府，听南京号令而各守其土。' },
  { id: 'zheng', name: '福建郑氏', short: '郑', color: '#2f7d78', polity: 'ming', leader: 'zhengzhilong', capital: 'anping', overlord: 'hongguang', loyalty: 55, playable: true,
    doctrine: '奉明而自主，握海上船队与贸易，重港口而轻陆战。' },
  { id: 'qing', name: '清', short: '清', color: '#3a5d8f', polity: 'qing', leader: 'duoergun', capital: 'beijing', playable: true,
    doctrine: '先逐大顺、接收北方，再图江南。' },
  { id: 'shun', name: '大顺', short: '顺', color: '#4f7a3a', polity: 'shun', leader: 'lizicheng', capital: 'xian', playable: true,
    doctrine: '退守关中，择地站稳。' },
  { id: 'xi', name: '张献忠部', short: '西', color: '#8a6a24', polity: 'xi', leader: 'zhangxianzhong', capital: 'kuizhou', playable: true,
    doctrine: '溯江入蜀，取重庆、成都，建大西。' },
  { id: 'helan', name: '荷兰东印度公司', short: '荷', color: '#c76a1c', polity: 'helan', leader: '', capital: 'dayuan', playable: false,
    doctrine: '据台湾大员，经营东亚贸易，不与陆上之争。' },
  { id: 'local', name: '地方豪强', short: '地', color: '#9a9283', polity: 'none', leader: '', capital: 'jinan', playable: false,
    doctrine: '大顺官吏被逐后，由地方士绅、团练自守。' },
];
