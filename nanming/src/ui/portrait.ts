/* 人物像：代码绘制的半身像。冠服按身份：皇帝翼善冠、明朝文官乌纱帽、武将凤翅盔、清朝官员暖帽、清将尖顶盔、
 * 起义军首领毡笠、士人方巾；袍色按品级与政权。面貌、胡须由人物 id 决定，同一人每次画得一样。 */
import type { Character } from '../core/types';
import { hashKeys } from '../core/rng';
import { traitsOf } from '../core/people';

/** 生年（据史，约数）：画像的年纪按登场时算——年长者须发斑白、额有皱纹，少年无须 */
const BORN: Record<string, number> = {
  zhuyousong: 1607, shikefa: 1601, mashiying: 1591, ruandacheng: 1587, qianqianyi: 1582, zuomaodi: 1601, yuanjixian: 1593, zhangguowei: 1595, gaojie: 1600, huangdegong: 1594,
  zuoliangyu: 1599, zuomenggeng: 1620, hetengjiao: 1592, qushisi: 1590, mutianbo: 1620, zhengzhilong: 1604, zhenghongkui: 1613, zhengsen: 1624, duoergun: 1612, duoduo: 1614,
  ajige: 1605, haoge: 1609, wusangui: 1612, hongchengchou: 1593, lizicheng: 1606, liuzongmin: 1607, zhangxianzhong: 1606, sunkewang: 1620, lidingguo: 1621, liuwenxiu: 1622,
  zhuyujian: 1602, zhuyihai: 1618, zhuyoulang: 1623, huangdaozhou: 1585, chenzilong: 1608, yanyingyuan: 1607, zhanghuangyan: 1620, guyanwu: 1613, huangzongxi: 1610, wangfuzhi: 1619,
  fangyizhi: 1611, songyingxing: 1587, fushan: 1607, sunqifeng: 1584, wuweiye: 1609, houfangyu: 1618, liuzongzhou: 1578, qibiaojia: 1602, qinliangyu: 1574, fanwencheng: 1597,
  aobai: 1610, zudashou: 1579, shilang: 1621, zhengjing: 1642, xuanye: 1654, fulin: 1638, kongyoude: 1602, shangkexi: 1604, gengzhongming: 1604, jierhalang: 1599,
  niujinxing: 1595, songxiance: 1600, gaohongtu: 1583, jiangyueguang: 1584, lvdaqi: 1586, duyinxi: 1601, chenbangyan: 1603, chenzizhuang: 1596, zhangjiayu: 1615, quedajun: 1630,
  weixi: 1624, liyong: 1627, jinbao: 1614, xiayunyi: 1596, houtongzeng: 1591, fengquan: 1595, hongxu: 1605, zhuchangfang: 1608, zhaozhilong: 1600, liguo: 1615, lilaiheng: 1630,
};
/** 画像年纪：据生年；不详者按 id 定在三十到六十之间 */
export function ageOf(c: Character): number {
  const year = c.appear ? 1644 + Math.floor(c.appear / 12) : 1644;
  if (BORN[c.id]) return year - BORN[c.id];
  return 30 + (hashKeys(c.id, 'age') % 31);
}
/** 品级：绯袍（三品以上）、青袍（四至七品）、绿袍（八九品与杂职） */
function rankOf(c: Character): 'hi' | 'mid' | 'lo' {
  const t = c.title;
  if (/尚书|大学士|首辅|总督|督师|巡抚|都御史|侍郎|太傅|太师|公|侯|伯|经略|总兵|提督|丞相|军师|王/.test(t)) return 'hi';
  if (/知县|县丞|推官|教谕|典史|主簿|把总|千总|营将|致仕|幕友|贡生|乡勇/.test(t)) return 'lo';
  return 'mid';
}

type Role = 'emperor' | 'qingEmperor' | 'civil' | 'general' | 'qingOfficial' | 'qingGeneral' | 'rebel' | 'scholar' | 'child';
const cache = new Map<string, string>();

function roleOf(c: Character, polity: string): Role {
  const t = c.title;
  if (c.id === 'fulin') return 'child';
  if (polity === 'qing') {
    if (/帝/.test(t)) return 'qingEmperor';
    if (c.ab.tong >= 60 && c.ab.tong >= c.ab.zheng) return 'qingGeneral';
    return 'qingOfficial';
  }
  if (/帝|监国|王$|^.王$/.test(t) || c.royal) return 'emperor';
  if (/处士|诸生|举人|名士|翰林|监生|世子|生员|乡绅|贡生|幕友/.test(t) && c.ab.tong < 60) return 'scholar';
  if ((polity === 'shun' || polity === 'xi') && c.ab.tong >= c.ab.zheng) return 'rebel';
  if (c.ab.tong >= 58 && c.ab.tong >= c.ab.zheng) return 'general';
  return 'civil';
}

/** 人物像的 dataURL（缓存）。w×h 默认 160×200 */
export function portrait(c: Character, color: string, polity: string): string {
  const key = c.id + color + polity + c.status;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 160, H = 200;
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  const h = hashKeys(c.id);
  const r = (k: number) => ((h >>> (k * 3)) & 0xff) / 255;
  const role = roleOf(c, polity);
  // 背景：势力色晕染 + 纸纹
  // 底色：势力色里调入本人的色调（主战者偏赭红，主和者偏青墨，余者按 id 取一味）
  const accent = c.att.hawk > 55 ? '#8a2a1a' : c.att.hawk < -25 ? '#2f4a52' : ['#3a5a6a', '#6a4a2a', '#4a5a3a', '#5a3a5a', '#8a6a2a', '#2a3a5a'][hashKeys(c.id, 'acc') % 6];
  const base = mixHex(color, accent, 0.42);
  const bg = g.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.45, H * 0.75);
  bg.addColorStop(0, shade(base, 0.35)); bg.addColorStop(1, shade(base, -0.55));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.08; for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect((i * 37 + h) % W, (i * 53 + (h >> 3)) % H, 1.5, 1.5); } g.globalAlpha = 1;
  // 远山淡影
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(40, 90 + r(1) * 20, 80, 115); g.quadraticCurveTo(120, 85 + r(2) * 20, 160, 112); g.lineTo(160, 200); g.lineTo(0, 200); g.fill();

  const cx = W / 2, faceY = 92, fw = 25 + r(3) * 4, fh = 31 + r(4) * 4;
  const traits = traitsOf(c);
  const rank = rankOf(c);
  const age = ageOf(c);
  const fx = (k: string) => (hashKeys(c.id, k) % 1000) / 1000;
  // 背景纹样：按身份与所长各异（水战者海浪、武将旌旗、文臣窗棂、士人竹影、起事者烽烟）
  drawBackdrop(g, W, H, role, traits, color, fx);
  // 身形微侧：每人略有不同的偏转与站位
  g.save(); g.translate(W / 2, H); g.rotate((fx('tilt') - 0.5) * 0.07); g.translate(-W / 2 + (fx('dx') - 0.5) * 10, -H);
  // 身后的兵器、器物（先画，袍服盖住下半）
  const martialRole = role === 'general' || role === 'qingGeneral' || role === 'rebel';
  const weapon = martialRole ? (traits.includes('xiaoyong') ? 'spear' : traits.includes('zhimou') ? 'fan' : traits.includes('lianbing') || role === 'qingGeneral' ? 'bow' : (['spear', 'sword', 'bow', 'halberd'] as const)[hashKeys(c.id, 'wp') % 4]) : null;
  if (weapon === 'spear' || weapon === 'halberd') {
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(cx + 52, H); g.lineTo(cx + 40, 18); g.stroke();
    g.fillStyle = '#c9ccd2'; g.beginPath(); g.moveTo(cx + 40, 4); g.lineTo(cx + 45, 22); g.lineTo(cx + 36, 21); g.closePath(); g.fill();
    g.fillStyle = '#c8352a'; g.beginPath(); g.moveTo(cx + 37, 22); g.quadraticCurveTo(cx + 30, 34, cx + 36, 42); g.quadraticCurveTo(cx + 44, 32, cx + 44, 23); g.fill();   // 枪缨
    if (weapon === 'halberd') { g.fillStyle = '#b8bcc2'; g.beginPath(); g.moveTo(cx + 42, 26); g.quadraticCurveTo(cx + 58, 22, cx + 56, 36); g.lineTo(cx + 43, 32); g.closePath(); g.fill(); }
  } else if (weapon === 'bow') {
    g.strokeStyle = '#6b4320'; g.lineWidth = 3; g.beginPath(); g.arc(cx - 70, 110, 52, -0.9, 0.9); g.stroke();
    g.strokeStyle = 'rgba(240,230,210,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 70 + 52 * Math.cos(-0.9), 110 + 52 * Math.sin(-0.9)); g.lineTo(cx - 70 + 52 * Math.cos(0.9), 110 + 52 * Math.sin(0.9)); g.stroke();
  } else if (weapon === 'sword') {
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 54, 70); g.lineTo(cx - 34, 150); g.stroke();
    g.fillStyle = '#d6b05a'; g.save(); g.translate(cx - 52, 78); g.rotate(-0.24); g.fillRect(-7, 0, 14, 3); g.restore();
    g.fillStyle = '#8f2015'; g.beginPath(); g.arc(cx - 55, 66, 3, 0, Math.PI * 2); g.fill();
  }
  // 袍服 / 甲
  const robe = role === 'emperor' ? '#d8a531' : role === 'qingEmperor' ? '#e0b43a' : role === 'civil' ? (rank === 'hi' ? '#a3281f' : rank === 'mid' ? '#2f5f8a' : '#3f6a3a') : role === 'qingOfficial' ? '#23344f'
    : role === 'scholar' ? pick0(c.id, 'scr', ['#4a5560', '#3a4a5a', '#5a5248', '#e6dcc6', '#4a3a30']) : role === 'rebel' ? '#5a4632' : role === 'child' ? '#e0b43a' : pick0(c.id, 'arm', ['#6d6f75', '#7a5a3a', '#4a4e58', '#8a3a2a']);
  g.fillStyle = role === 'emperor' || role === 'qingEmperor' || role === 'child' ? robe : shade(robe, ((hashKeys(c.id + ':robe') % 100) / 100 - 0.5) * 0.5);
  g.beginPath(); g.moveTo(cx - 70, H); g.bezierCurveTo(cx - 66, 150, cx - 40, 134, cx - 16, 130); g.lineTo(cx + 16, 130); g.bezierCurveTo(cx + 40, 134, cx + 66, 150, cx + 70, H); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke();
  if (role === 'general' || role === 'qingGeneral' || role === 'rebel') {
    // 甲片
    g.strokeStyle = role === 'rebel' ? 'rgba(30,20,10,0.4)' : 'rgba(230,220,200,0.35)'; g.lineWidth = 1;
    const armour = role === 'rebel' ? 'cloth' : (['scale', 'lamellar', 'studded'] as const)[hashKeys(c.id, 'armour') % 3];
    if (armour === 'scale') for (let y = 142; y < H; y += 7) for (let x = cx - 60; x < cx + 60; x += 9) { g.beginPath(); g.arc(x + ((y / 7) % 2) * 4.5, y, 4.5, 0, Math.PI); g.stroke(); }
    else if (armour === 'lamellar') for (let y = 140; y < H; y += 9) for (let x = cx - 62; x < cx + 62; x += 6) { g.strokeRect(x, y, 5, 8); }
    else if (armour === 'studded') { g.fillStyle = 'rgba(230,200,120,0.75)'; for (let y = 146; y < H; y += 8) for (let x = cx - 58; x < cx + 58; x += 8) { g.beginPath(); g.arc(x + ((y / 8) % 2) * 4, y, 1.3, 0, Math.PI * 2); g.fill(); } }
    else { g.strokeStyle = 'rgba(30,20,10,0.3)'; for (let y = 145; y < H; y += 10) { g.beginPath(); g.moveTo(cx - 60, y); g.quadraticCurveTo(cx, y + 6, cx + 60, y); g.stroke(); } }
    // 护心镜（高阶将领）
    if (rank === 'hi' && role !== 'rebel') { g.fillStyle = '#d8dce2'; g.beginPath(); g.arc(cx, 168, 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#8a6a30'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(cx - 3, 165, 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = role === 'qingGeneral' ? '#2f4f7f' : '#8f2015';
    g.fillRect(cx - 62, 150, 124, 6); // 束甲带
    // 披风
    g.fillStyle = shade(color, -0.2); g.beginPath(); g.moveTo(cx - 70, H); g.lineTo(cx - 52, 140); g.lineTo(cx - 40, 145); g.lineTo(cx - 50, H); g.fill();
    g.beginPath(); g.moveTo(cx + 70, H); g.lineTo(cx + 52, 140); g.lineTo(cx + 40, 145); g.lineTo(cx + 50, H); g.fill();
  } else {
    // 交领右衽
    g.strokeStyle = 'rgba(255,240,210,0.75)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 16, 131); g.lineTo(cx + 12, 168); g.stroke();
    g.beginPath(); g.moveTo(cx + 16, 131); g.lineTo(cx + 4, 148); g.stroke();
    if (role === 'civil') {
      // 暗云纹
      g.strokeStyle = 'rgba(255,240,210,0.12)'; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) { const x = cx - 52 + (k % 3) * 46 + (hashKeys(c.id, 'cl' + k) % 10), y = 150 + Math.floor(k / 3) * 26; g.beginPath(); g.arc(x, y, 5, Math.PI, Math.PI * 2.4); g.arc(x + 8, y, 4, Math.PI, Math.PI * 2.2); g.stroke(); }
      // 补子：一至三品仙鹤、锦鸡、孔雀；四至七品云雁、白鹇、鸂鶒；八九品黄鹂、鹌鹑
      g.fillStyle = rank === 'hi' ? '#e8c46a' : rank === 'mid' ? '#cfd6c2' : '#c8b88a'; g.fillRect(cx - 18, 166, 36, 28);
      g.strokeStyle = '#3a2a10'; g.lineWidth = 1; g.strokeRect(cx - 18, 166, 36, 28);
      drawBird(g, cx, 181, rank, hashKeys(c.id, 'bird'));
    }
    if (role === 'emperor' || role === 'qingEmperor' || role === 'child') { g.strokeStyle = 'rgba(160,40,20,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(cx - 34, 172, 9, 0, Math.PI * 1.6); g.stroke(); g.beginPath(); g.arc(cx + 34, 172, 9, Math.PI, Math.PI * 2.6); g.stroke(); }
    if (role === 'qingOfficial') { g.fillStyle = '#1a2538'; g.beginPath(); g.ellipse(cx, 138, 40, 12, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(240,210,130,0.85)'; g.fillRect(cx - 16, 165, 32, 26); }
  }
  // 面貌：脸型、肤色、眉、眼、鼻、口、须、痣疤、皱纹各取一套，互不相关地由 id 决定——同一人每次一样，不同人很少撞脸
  const hv = (k: string) => hashKeys(c.id + ':' + k);
  const pick = <T,>(k: string, arr: T[]) => arr[hv(k) % arr.length];
  const fr = (k: string) => (hv(k) % 1000) / 1000;
  const skin = pick('skin', ['#e8c49a', '#dcb487', '#d2a77c', '#e3bd94', '#c99b70', '#efcfa8', '#d8ae86', '#bf9168']);
  const young = age < 28 || role === 'child';
  const old = !young && age >= 55;
  const greying = !young && !old && age >= 46;
  const jaw = pick('jaw', ['round', 'square', 'long', 'pointed', 'broad'] as const);
  const fw2 = fw + (jaw === 'broad' ? 3 : jaw === 'long' || jaw === 'pointed' ? -2 : 0), fh2 = fh + (jaw === 'long' ? 4 : jaw === 'broad' ? -2 : 0);
  g.fillStyle = shade(skin, -0.12); g.fillRect(cx - 10, faceY + fh2 - 8, 20, 22);
  g.fillStyle = skin;
  g.beginPath();
  if (jaw === 'square' || jaw === 'broad') {
    g.moveTo(cx - fw2, faceY - 6); g.quadraticCurveTo(cx - fw2, faceY - fh2, cx, faceY - fh2); g.quadraticCurveTo(cx + fw2, faceY - fh2, cx + fw2, faceY - 6);
    g.lineTo(cx + fw2 - 1, faceY + fh2 * 0.55); g.quadraticCurveTo(cx + fw2 * 0.7, faceY + fh2, cx, faceY + fh2); g.quadraticCurveTo(cx - fw2 * 0.7, faceY + fh2, cx - fw2 + 1, faceY + fh2 * 0.55); g.closePath();
  } else if (jaw === 'pointed') {
    g.moveTo(cx - fw2, faceY - 4); g.quadraticCurveTo(cx - fw2, faceY - fh2, cx, faceY - fh2); g.quadraticCurveTo(cx + fw2, faceY - fh2, cx + fw2, faceY - 4);
    g.quadraticCurveTo(cx + fw2 - 2, faceY + fh2 * 0.6, cx, faceY + fh2 + 2); g.quadraticCurveTo(cx - fw2 + 2, faceY + fh2 * 0.6, cx - fw2, faceY - 4); g.closePath();
  } else g.ellipse(cx, faceY, fw2, fh2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(60,35,15,0.55)'; g.lineWidth = 1.2; g.stroke();
  // 腮红与颧骨阴影
  g.fillStyle = 'rgba(190,90,60,0.12)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * fw2 * 0.55, faceY + 7, 6, 4, 0, 0, Math.PI * 2); g.fill(); }
  // 耳
  g.fillStyle = skin; g.beginPath(); g.ellipse(cx - fw2 + 1, faceY + 2, 4, 7, 0, 0, Math.PI * 2); g.ellipse(cx + fw2 - 1, faceY + 2, 4, 7, 0, 0, Math.PI * 2); g.fill();
  const ink = '#1e140c';
  const hairCol = old ? pick('grey', ['#b8b3aa', '#a9a49c', '#d6d2ca']) : greying ? pick('grey2', ['#5a5650', '#4a4640']) : ink;
  // 眉：粗细、长短、走势（平、挑、蹙、八字）
  const martial = role === 'general' || role === 'qingGeneral' || role === 'rebel';
  const browW = c.female ? 1.5 : (martial ? 2.6 : 1.8) + fr('bw') * 1.8, browL = 9 + fr('bl') * 6, browKind = pick('bk', ['flat', 'raised', 'knit', 'droop'] as const);
  const by = faceY - 10 - fr('by') * 3;
  g.strokeStyle = hairCol; g.lineCap = 'round'; g.lineWidth = browW;
  for (const sx of [-1, 1]) {
    const inner = cx + sx * 5, outer = cx + sx * (5 + browL);
    const di = browKind === 'knit' ? 2 : browKind === 'droop' ? -2 : 0, dout = browKind === 'raised' ? -3 : browKind === 'droop' ? 3 : 0;
    g.beginPath(); g.moveTo(inner, by + di); g.quadraticCurveTo((inner + outer) / 2, by - 2.5, outer, by + dout); g.stroke();
  }
  // 眼：细长、圆、垂、锐、凤眼；眼距
  const eyeKind = pick('ek', ['narrow', 'round', 'droop', 'sharp', 'phoenix'] as const), es = 10 + fr('es') * 3;
  g.lineWidth = 1.7; g.strokeStyle = ink; g.fillStyle = ink;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * es, ey = faceY - 3;
    g.beginPath();
    if (eyeKind === 'round') { g.ellipse(ex, ey, 4.2, 2.6, 0, Math.PI, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(ex, ey - 0.6, 1.9, 0, Math.PI * 2); g.fill(); continue; }
    const lift = eyeKind === 'sharp' || eyeKind === 'phoenix' ? -2.2 : eyeKind === 'droop' ? 1.8 : 0;
    g.moveTo(ex - sx * 5, ey + (eyeKind === 'phoenix' ? 1 : 0)); g.quadraticCurveTo(ex, ey - (eyeKind === 'narrow' ? 1.6 : 3), ex + sx * 5, ey + lift); g.stroke();
    g.beginPath(); g.arc(ex, ey - 0.4, eyeKind === 'narrow' ? 1.2 : 1.6, 0, Math.PI * 2); g.fill();
    if (old) { g.strokeStyle = 'rgba(60,35,15,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(ex + sx * 5, ey + 1); g.lineTo(ex + sx * 8, ey + 3); g.stroke(); g.strokeStyle = ink; g.lineWidth = 1.7; }
  }
  // 鼻：直、钩、宽、短
  const noseKind = pick('nk', ['straight', 'hook', 'wide', 'short'] as const), nl = noseKind === 'short' ? 7 : 10 + fr('nl') * 3;
  g.lineWidth = 1.3; g.strokeStyle = 'rgba(60,35,15,0.8)';
  g.beginPath(); g.moveTo(cx - 1, faceY - 2);
  if (noseKind === 'hook') { g.quadraticCurveTo(cx - 5, faceY + nl * 0.6, cx - 3, faceY + nl); g.lineTo(cx + 2, faceY + nl + 1); }
  else { g.lineTo(cx - 3, faceY + nl); g.lineTo(cx + (noseKind === 'wide' ? 4 : 2), faceY + nl + 1); }
  g.stroke();
  if (noseKind === 'wide') { g.beginPath(); g.arc(cx - 5, faceY + nl, 1.5, 0, Math.PI); g.arc(cx + 5, faceY + nl, 1.5, 0, Math.PI); g.stroke(); }
  // 口：宽窄、上扬下撇
  const mw = 5 + fr('mw') * 3, mc = (fr('mc') - 0.5) * 4, my = faceY + 17 + (jaw === 'long' ? 2 : 0);
  g.beginPath(); g.moveTo(cx - mw, my + mc * 0.5); g.quadraticCurveTo(cx, my + 1.5 - mc, cx + mw, my + mc * 0.5); g.stroke();
  // 皱纹（年长者）、法令纹
  if (old || fr('lines') < 0.35) { g.strokeStyle = 'rgba(60,35,15,0.35)'; g.lineWidth = 0.9; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 6, faceY + 8); g.quadraticCurveTo(cx + sx * 10, faceY + 14, cx + sx * 9, faceY + 19); g.stroke(); } }
  if (old) { g.strokeStyle = 'rgba(60,35,15,0.3)'; g.lineWidth = 0.8; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(cx - 9, faceY - 17 - k * 3); g.quadraticCurveTo(cx, faceY - 19 - k * 3, cx + 9, faceY - 17 - k * 3); g.stroke(); } }
  // 痣、疤
  if (fr('mole') < 0.18) { g.fillStyle = '#3a2416'; g.beginPath(); g.arc(cx + (fr('mx') - 0.5) * fw2 * 1.2, faceY + 4 + fr('my') * 10, 1.3, 0, Math.PI * 2); g.fill(); }
  if (martial && !c.female && fr('scar') < 0.3) { g.strokeStyle = 'rgba(140,60,50,0.7)'; g.lineWidth = 1.4; const sx0 = cx + (fr('sx') > 0.5 ? 1 : -1) * 14; g.beginPath(); g.moveTo(sx0 - 3, faceY - 12); g.lineTo(sx0 + 4, faceY + 4); g.stroke(); }
  // 须：无须、八字、一字、山羊、三绺长须、络腮、短髭、虬髯——武将偏络腮虬髯，文臣偏长须
  if (c.female) { g.fillStyle = 'rgba(170,50,40,0.6)'; g.beginPath(); g.ellipse(cx, my + 0.5, mw * 0.6, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  if (!young && !c.female) {
    g.strokeStyle = hairCol; g.fillStyle = hairCol;
    const style = martial ? pick('beard', ['full', 'curly', 'mus', 'goatee', 'stubble', 'full', 'long'] as const) : pick('beard', ['long', 'long', 'goatee', 'mus', 'eight', 'none', 'stubble'] as const);
    g.lineWidth = 1.6;
    if (style !== 'none' && style !== 'stubble') {
      if (style === 'eight') { for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 2, my - 4); g.quadraticCurveTo(cx + sx * 8, my - 4, cx + sx * 12, my + 2); g.stroke(); } }
      else { g.beginPath(); g.moveTo(cx - 9, my - 3); g.quadraticCurveTo(cx - 3, my - 6, cx, my - 4); g.quadraticCurveTo(cx + 3, my - 6, cx + 9, my - 3); g.stroke(); }
    }
    if (style === 'stubble') { g.globalAlpha = 0.18; g.beginPath(); g.ellipse(cx, my + 6, fw2 * 0.75, 10, 0, 0, Math.PI); g.fill(); g.globalAlpha = 1; }
    if (style === 'goatee') { g.beginPath(); g.moveTo(cx - 4, my + 4); g.quadraticCurveTo(cx, my + 18 + fr('gl') * 8, cx + 4, my + 4); g.fill(); }
    if (style === 'long') { g.lineWidth = 1.2; for (const dx of [-5, 0, 5]) { g.beginPath(); g.moveTo(cx + dx, my + 4); g.quadraticCurveTo(cx + dx * 1.3, my + 17, cx + dx * 0.8, my + 29 + fr('bl2') * 8); g.stroke(); } }
    if (style === 'full' || style === 'curly') {
      g.globalAlpha = 0.88; g.beginPath(); g.moveTo(cx - fw2 + 3, faceY + 4); g.quadraticCurveTo(cx - fw2 + 2, faceY + 30, cx, faceY + 36 + (style === 'curly' ? 6 : 0)); g.quadraticCurveTo(cx + fw2 - 2, faceY + 30, cx + fw2 - 3, faceY + 4); g.quadraticCurveTo(cx + 12, my + 5, cx, my + 4); g.quadraticCurveTo(cx - 12, my + 5, cx - fw2 + 3, faceY + 4); g.fill(); g.globalAlpha = 1;
      if (style === 'curly') { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(cx - 12 + k * 4, my + 12 + (k % 2) * 6, 2.5, 0, Math.PI * 1.5); g.stroke(); } }
    }
  }
  if (role === 'qingGeneral' || role === 'qingOfficial' || role === 'qingEmperor' || role === 'child') {
    // 剃发：前额青色
    g.fillStyle = 'rgba(80,90,85,0.35)'; g.beginPath(); g.ellipse(cx, faceY - fh2 + 8, fw2 - 3, 10, 0, Math.PI, Math.PI * 2); g.fill();
  }
  // 冠帽（同一身份也有几种样式、几种颜色）
  const top = faceY - fh2;

  const metal = pick('metal', ['#8a8d93', '#9a7a48', '#4a4a50', '#a0a4aa', '#6e5a3a']);
  const plume = pick('plume', ['#c8352a', '#2f2f2f', '#d6b05a', '#7a1a12', '#e8e2d0']);
  g.lineWidth = 1.2;
  if (c.female && !martialRole) {
    // 女子：高髻、簪钗
    g.fillStyle = '#16120e'; g.beginPath(); g.ellipse(cx, top + 8, fw + 3, 18, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx, top - 14, 13, 12, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d6b05a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 20, top - 8); g.lineTo(cx + 18, top - 20); g.stroke();
    g.fillStyle = '#c8352a'; g.beginPath(); g.arc(cx + 18, top - 20, 3, 0, Math.PI * 2); g.fill();
  } else
  switch (role) {
    case 'emperor': {
      g.fillStyle = '#16120e'; g.beginPath(); g.moveTo(cx - fw - 1, top + 12); g.quadraticCurveTo(cx, top - 26, cx + fw + 1, top + 12); g.closePath(); g.fill();
      g.fillStyle = '#16120e'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * 10, top - 14, 9, 13, sx * 0.5, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#d6b05a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - fw, top + 10); g.quadraticCurveTo(cx, top + 2, cx + fw, top + 10); g.stroke();
      g.fillStyle = '#d6b05a'; g.beginPath(); g.arc(cx, top - 4, 3, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'civil': {
      if (old && c.ab.wang >= 70 && fx('zj') < 0.5) {
        // 忠静冠：燕居之冠，冠顶三梁
        g.fillStyle = '#1a1612'; g.beginPath(); g.moveTo(cx - fw, top + 12); g.lineTo(cx - fw + 3, top - 16); g.lineTo(cx + fw - 3, top - 16); g.lineTo(cx + fw, top + 12); g.closePath(); g.fill();
        g.strokeStyle = '#d6b05a'; g.lineWidth = 1.2; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(cx + dx, top - 15); g.lineTo(cx + dx, top + 8); g.stroke(); }
        g.strokeStyle = '#d6b05a'; g.beginPath(); g.moveTo(cx - fw + 2, top + 6); g.lineTo(cx + fw - 2, top + 6); g.stroke();
        break;
      }
      const wing = 22 + Math.round(fx('wing') * 14);
      g.fillStyle = '#121010'; g.beginPath(); g.moveTo(cx - fw, top + 12); g.lineTo(cx - fw + 2, top - 4); g.quadraticCurveTo(cx, top - 14, cx + fw - 2, top - 4); g.lineTo(cx + fw, top + 12); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(cx, top - 10, 15, 11, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillRect(cx - fw - wing, top + 1, wing, 5); g.fillRect(cx + fw, top + 1, wing, 5); // 乌纱展角
      g.fillStyle = '#2a2420'; g.fillRect(cx - fw - wing, top + 1, 6, 5); g.fillRect(cx + fw + wing - 6, top + 1, 6, 5);
      break;
    }
    case 'scholar': {
      if (fr('hat') < 0.4) { // 东坡巾 / 幅巾
        g.fillStyle = pick('sc', ['#1c1c22', '#2a3a4a', '#3a2a22']); g.beginPath(); g.moveTo(cx - fw - 1, top + 12); g.quadraticCurveTo(cx - fw, top - 18, cx, top - 20); g.quadraticCurveTo(cx + fw, top - 18, cx + fw + 1, top + 12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(cx + fw - 4, top - 6); g.quadraticCurveTo(cx + fw + 16, top + 6, cx + fw + 10, top + 30); g.lineTo(cx + fw + 4, top + 28); g.closePath(); g.fill();
        break;
      }
      g.fillStyle = '#1c1c22'; g.beginPath(); g.moveTo(cx - fw + 1, top + 12); g.lineTo(cx - fw + 4, top - 22); g.lineTo(cx + fw - 4, top - 22); g.lineTo(cx + fw - 1, top + 12); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(cx, top - 21); g.lineTo(cx, top + 10); g.stroke();
      break;
    }
    case 'general': {
      if (rank === 'lo' || fx('helm') < 0.25) {
        // 笠盔（营将、偏裨）：圆顶宽檐
        g.fillStyle = metal; g.beginPath(); g.ellipse(cx, top + 6, fw + 16, 7, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(cx, top + 4, fw - 1, 18, 0, Math.PI, Math.PI * 2); g.fill();
        g.strokeStyle = '#3c3e42'; g.lineWidth = 1; g.stroke();
        g.fillStyle = plume; g.beginPath(); g.arc(cx, top - 15, 4, 0, Math.PI * 2); g.fill();
        break;
      }
      g.fillStyle = metal; g.beginPath(); g.ellipse(cx, top + 6, fw + 3, 22, 0, Math.PI, Math.PI * 2); g.fill();
      g.strokeStyle = '#3c3e42'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#b8bcc2'; g.fillRect(cx - fw - 3, top + 4, (fw + 3) * 2, 6);
      for (const sx of [-1, 1]) { g.fillStyle = '#d6b05a'; g.beginPath(); g.moveTo(cx + sx * (fw - 2), top - 4); g.quadraticCurveTo(cx + sx * (fw + 16), top - 22, cx + sx * (fw + 10), top - 2); g.closePath(); g.fill(); } // 凤翅
      g.fillStyle = plume; g.beginPath(); g.moveTo(cx, top - 16); g.quadraticCurveTo(cx - 6, top - 34, cx + 4, top - 44); g.quadraticCurveTo(cx + 6, top - 30, cx + 3, top - 16); g.fill(); // 盔缨
      g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, top - 16); g.lineTo(cx, top - 6); g.stroke();
      break;
    }
    case 'qingGeneral': {
      g.fillStyle = '#3a3d44'; g.beginPath(); g.ellipse(cx, top + 6, fw + 2, 21, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#d6b05a'; g.fillRect(cx - fw - 2, top + 4, (fw + 2) * 2, 5);
      g.strokeStyle = '#d6b05a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, top - 14); g.lineTo(cx, top - 46); g.stroke(); // 尖顶
      g.fillStyle = '#c8352a'; g.beginPath(); g.arc(cx, top - 30, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a2d33'; g.lineWidth = 1; for (const sx of [-1, 1]) { g.fillStyle = '#4a4d55'; g.fillRect(cx + sx * (fw + 2) - (sx > 0 ? 0 : 8), top + 6, 8, 26); }
      break;
    }
    case 'qingOfficial': case 'qingEmperor': case 'child': {
      g.fillStyle = role === 'qingOfficial' ? '#1e1a18' : '#2a2218'; g.beginPath(); g.ellipse(cx, top + 6, fw + 6, 16, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3a20'; g.fillRect(cx - fw - 6, top + 3, (fw + 6) * 2, 5);
      g.fillStyle = '#c8352a'; g.beginPath(); g.moveTo(cx - fw, top); g.quadraticCurveTo(cx, top - 22, cx + fw, top); g.fill(); // 红缨
      g.fillStyle = role === 'qingOfficial' ? '#a0c0e0' : '#e8c040'; g.beginPath(); g.arc(cx, top - 14, 4, 0, Math.PI * 2); g.fill(); // 顶珠
      break;
    }
    case 'rebel': {
      if (fr('hat') < 0.45) { // 包头巾
        g.fillStyle = pick('scarf', ['#8f2015', '#3a3a3a', '#5a4632', '#a8742a']); g.beginPath(); g.ellipse(cx, top + 4, fw + 2, 16, 0, Math.PI, Math.PI * 2); g.fill();
        g.fillRect(cx - fw - 2, top + 1, (fw + 2) * 2, 6);
        g.beginPath(); g.moveTo(cx + fw - 2, top + 2); g.quadraticCurveTo(cx + fw + 14, top + 10, cx + fw + 8, top + 26); g.lineTo(cx + fw + 2, top + 22); g.closePath(); g.fill();
        break;
      }
      g.fillStyle = '#6b5638'; g.beginPath(); g.ellipse(cx, top + 6, fw + 20, 8, 0, 0, Math.PI * 2); g.fill(); // 毡笠帽檐
      g.fillStyle = '#7b6542'; g.beginPath(); g.ellipse(cx, top, fw - 2, 16, 0, Math.PI, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,20,10,0.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#8f2015'; g.fillRect(cx - fw + 2, top - 4, (fw - 2) * 2, 4);
      break;
    }
  }
  // 手中之物：文臣执笏，士人持扇或书卷，儒将羽扇
  const civilItem = role !== 'civil' ? null : traits.includes('licai') ? 'abacus' : traits.includes('tuntian') ? 'rice' : traits.includes('biancai') ? 'scroll' : fx('hu') < 0.6 ? 'hu' : null;
  if (civilItem === 'abacus' || civilItem === 'rice' || civilItem === 'scroll') {
    g.save(); g.translate(cx + 34, 172);
    if (civilItem === 'abacus') { g.fillStyle = '#5a3a1e'; g.fillRect(-14, -10, 28, 20); g.fillStyle = '#e8d8b0'; g.fillRect(-12, -8, 24, 16); g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.8; for (let k = -9; k <= 9; k += 4.5) { g.beginPath(); g.moveTo(k, -8); g.lineTo(k, 8); g.stroke(); } g.beginPath(); g.moveTo(-12, -3); g.lineTo(12, -3); g.stroke(); g.fillStyle = '#7a2a1a'; for (let k = -9; k <= 9; k += 4.5) for (const dy of [-6, 1, 4.5]) { g.beginPath(); g.ellipse(k, dy, 1.8, 1.2, 0, 0, Math.PI * 2); g.fill(); } }
    else if (civilItem === 'rice') { g.strokeStyle = '#8a7a3a'; g.lineWidth = 1.2; for (const a of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(0, 16); g.quadraticCurveTo(a * 30, -6, a * 40 + 6, -22); g.stroke(); g.fillStyle = '#d8b84a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(a * 34 + 4 + k * 0.6, -6 - k * 3.5, 1.8, 2.8, 0.4, 0, Math.PI * 2); g.fill(); } } }
    else { g.rotate(0.35); g.fillStyle = '#e8dcbc'; g.fillRect(-6, -18, 12, 34); g.fillStyle = '#7a4a22'; g.fillRect(-8, -20, 16, 4); g.fillRect(-8, 14, 16, 4); }
    g.fillStyle = skin; g.beginPath(); g.ellipse(0, 16, 7, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  } else if (civilItem === 'hu') {
    g.save(); g.translate(cx + 30, 176); g.rotate(-0.18);
    g.fillStyle = '#efe6cf'; g.beginPath(); g.moveTo(-4, -26); g.lineTo(4, -26); g.lineTo(5, 24); g.lineTo(-5, 24); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,60,30,0.6)'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = skin; g.beginPath(); g.ellipse(0, 14, 8, 6, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  } else if (role === 'scholar' || weapon === 'fan') {
    const kind = weapon === 'fan' ? 'feather' : fx('held') < 0.5 ? 'fan' : 'scroll';
    g.save(); g.translate(cx + 34, 172);
    if (kind === 'fan') { g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(0, 14); g.arc(0, 14, 26, -Math.PI * 0.85, -Math.PI * 0.35); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 0.7; for (let a = -0.85; a <= -0.35; a += 0.1) { g.beginPath(); g.moveTo(0, 14); g.lineTo(Math.cos(a * Math.PI) * 26, 14 + Math.sin(a * Math.PI) * 26); g.stroke(); } g.fillStyle = 'rgba(40,60,40,0.5)'; g.beginPath(); g.moveTo(-12, -2); g.quadraticCurveTo(-4, -8, 2, -6); g.lineTo(-2, 0); g.fill(); }
    else if (kind === 'feather') { g.fillStyle = '#efe9dc'; g.beginPath(); g.moveTo(0, 16); g.quadraticCurveTo(-18, -6, -4, -28); g.quadraticCurveTo(10, -8, 0, 16); g.fill(); g.strokeStyle = 'rgba(80,70,50,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 16); g.lineTo(-4, -24); g.stroke(); }
    else { g.rotate(0.35); g.fillStyle = '#e8dcbc'; g.fillRect(-6, -18, 12, 34); g.fillStyle = '#7a4a22'; g.fillRect(-8, -20, 16, 4); g.fillRect(-8, 14, 16, 4); g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 0.6; for (let y = -12; y < 12; y += 4) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y); g.stroke(); } }
    g.fillStyle = skin; g.beginPath(); g.ellipse(0, 16, 7, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.restore();
  // 状态：被执、已故
  if (c.status === 'dead' || c.status === 'captured') {
    g.fillStyle = 'rgba(10,8,6,0.45)'; g.fillRect(0, 0, W, H);
    const im = g.getImageData(0, 0, W * 2, H * 2), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(im, 0, 0);
  }
  // 画框暗角
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}

const pick0 = <T,>(id: string, k: string, arr: T[]) => arr[hashKeys(id + ':' + k) % arr.length];

/** 背景纹样 */
function drawBackdrop(g: CanvasRenderingContext2D, W: number, H: number, role: Role, traits: string[], color: string, fx: (k: string) => number) {
  g.save();
  if (traits.includes('shuishi')) {
    // 海浪
    g.strokeStyle = 'rgba(220,240,255,0.16)'; g.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) { const y = 70 + row * 16; g.beginPath(); for (let x = -10; x <= W + 10; x += 16) { g.moveTo(x, y); g.arc(x + 8, y, 8, Math.PI, Math.PI * 2); } g.stroke(); }
  } else if (role === 'general' || role === 'qingGeneral') {
    // 旌旗
    for (const [x, tilt] of [[18 + fx('f1') * 14, -0.08], [W - 30 - fx('f2') * 14, 0.06]] as const) {
      g.strokeStyle = 'rgba(20,14,8,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, H * 0.75); g.lineTo(x + tilt * 100, 12); g.stroke();
      g.fillStyle = shade(color, -0.25); g.globalAlpha = 0.55; g.beginPath(); g.moveTo(x + tilt * 100, 14); g.quadraticCurveTo(x + 18, 22, x + 28, 18); g.lineTo(x + 26, 46); g.quadraticCurveTo(x + 14, 50, x + tilt * 70, 44); g.closePath(); g.fill(); g.globalAlpha = 1;
    }
  } else if (role === 'civil' || role === 'emperor' || role === 'qingOfficial') {
    const motif = role === 'emperor' ? 'screen' : (['lattice', 'books', 'plum', 'moon'] as const)[Math.floor(fx('motif') * 4)];
    const x0 = fx('win') < 0.5 ? 8 : W - 58;
    if (motif === 'lattice') {
      g.strokeStyle = 'rgba(255,240,210,0.1)'; g.lineWidth = 1.2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x0 + i * 12, 14); g.lineTo(x0 + i * 12, 86); g.stroke(); }
      for (let j = 0; j <= 6; j++) { g.beginPath(); g.moveTo(x0, 14 + j * 12); g.lineTo(x0 + 48, 14 + j * 12); g.stroke(); }
    } else if (motif === 'books') {
      g.fillStyle = 'rgba(20,14,8,0.22)'; g.fillRect(x0 - 4, 20, 56, 3); g.fillRect(x0 - 4, 52, 56, 3);
      for (let k = 0; k < 8; k++) { g.fillStyle = ['rgba(240,220,170,0.16)', 'rgba(60,80,110,0.25)', 'rgba(120,40,30,0.22)'][k % 3]; g.fillRect(x0 + k * 6, 24 + (k % 2) * 4, 5, 28 - (k % 2) * 4); g.fillRect(x0 + k * 6, 56 + (k % 3) * 2, 5, 26 - (k % 3) * 2); }
    } else if (motif === 'plum') {
      g.strokeStyle = 'rgba(30,18,10,0.35)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0 < 40 ? 0 : W, 30); g.quadraticCurveTo(W / 2 - (x0 < 40 ? 30 : -30), 20, x0 < 40 ? 60 : W - 60, 50); g.stroke();
      g.fillStyle = 'rgba(255,220,230,0.4)'; for (let k = 0; k < 7; k++) { const px = x0 < 40 ? 8 + k * 8 : W - 8 - k * 8; g.beginPath(); g.arc(px, 30 + Math.sin(k * 1.7) * 9 + k * 2, 2.6, 0, Math.PI * 2); g.fill(); }
    } else if (motif === 'moon') {
      g.fillStyle = 'rgba(255,246,220,0.22)'; g.beginPath(); g.arc(x0 < 40 ? 34 : W - 34, 38, 18, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,246,220,0.12)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x0 < 40 ? 10 : W - 70, 70 + k * 6); g.lineTo(x0 < 40 ? 70 : W - 10, 68 + k * 6); g.stroke(); }
    } else {
      // 屏风
      g.fillStyle = 'rgba(214,176,90,0.12)'; for (let k = 0; k < 4; k++) g.fillRect(6 + k * 38, 10, 34, 96);
      g.strokeStyle = 'rgba(214,176,90,0.2)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) g.strokeRect(6 + k * 38, 10, 34, 96);
    }
  } else if (role === 'scholar') {
    // 竹影
    g.strokeStyle = 'rgba(30,50,30,0.22)'; g.fillStyle = 'rgba(30,50,30,0.2)';
    for (const bx of [14 + fx('b1') * 10, W - 22 - fx('b2') * 10]) {
      g.lineWidth = 3; g.beginPath(); g.moveTo(bx, H); g.lineTo(bx + 4, 0); g.stroke();
      for (let y = 20; y < H; y += 28) { g.beginPath(); g.moveTo(bx + 2, y); g.quadraticCurveTo(bx + 16, y - 6, bx + 24, y + 2); g.quadraticCurveTo(bx + 14, y + 2, bx + 2, y); g.fill(); }
    }
  } else if (role === 'rebel') {
    // 烽烟
    const gr = g.createRadialGradient(W * 0.2, H * 0.85, 4, W * 0.2, H * 0.85, 70);
    gr.addColorStop(0, 'rgba(255,150,60,0.35)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(40,30,25,0.18)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(W * 0.2 + k * 9, H * 0.7 - k * 22, 10 + k * 4, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}

/** 补子上的禽鸟：高品白鹤红顶，中品雁、鹇，低品黄鹂 */
function drawBird(g: CanvasRenderingContext2D, x: number, y: number, rank: 'hi' | 'mid' | 'lo', h: number) {
  const body = rank === 'hi' ? '#f6f2ea' : rank === 'mid' ? (h % 2 ? '#f0f0f0' : '#8a7a5a') : '#d8a830';
  g.save(); g.translate(x, y); if (h % 3 === 0) g.scale(-1, 1);
  g.fillStyle = body; g.strokeStyle = '#3a2a10'; g.lineWidth = 0.7;
  g.beginPath(); g.ellipse(0, 3, 7, 4, -0.3, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(8, -6, 6, -10); g.stroke();
  g.beginPath(); g.arc(6, -10, 2, 0, Math.PI * 2); g.fill(); g.stroke();
  if (rank === 'hi') { g.fillStyle = '#c8352a'; g.beginPath(); g.arc(6, -11.5, 1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = shade(body, -0.25); g.beginPath(); g.moveTo(-2, 1); g.quadraticCurveTo(-10, -8, -12, -3); g.quadraticCurveTo(-8, 2, -2, 4); g.fill();
  g.strokeStyle = '#3a2a10'; g.beginPath(); g.moveTo(8, -10); g.lineTo(11, -9); g.stroke();
  g.fillStyle = 'rgba(80,120,160,0.6)'; g.beginPath(); g.ellipse(0, 11, 9, 1.6, 0, 0, Math.PI * 2); g.fill();   // 水纹
  g.restore();
}

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}
