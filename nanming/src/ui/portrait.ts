/* 人物像：代码绘制的半身像。冠服按身份：皇帝翼善冠、明朝文官乌纱帽、武将凤翅盔、清朝官员暖帽、清将尖顶盔、
 * 起义军首领毡笠、士人方巾；袍色按品级与政权。面貌、胡须由人物 id 决定，同一人每次画得一样。 */
import type { Character } from '../core/types';
import { hashKeys } from '../core/rng';

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
  if (/处士|诸生|举人|名士|翰林|监生|世子/.test(t) && c.ab.tong < 60) return 'scholar';
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
  const bg = g.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.45, H * 0.75);
  bg.addColorStop(0, shade(color, 0.35)); bg.addColorStop(1, shade(color, -0.55));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.08; for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect((i * 37 + h) % W, (i * 53 + (h >> 3)) % H, 1.5, 1.5); } g.globalAlpha = 1;
  // 远山淡影
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(40, 90 + r(1) * 20, 80, 115); g.quadraticCurveTo(120, 85 + r(2) * 20, 160, 112); g.lineTo(160, 200); g.lineTo(0, 200); g.fill();

  const cx = W / 2, faceY = 92, fw = 25 + r(3) * 4, fh = 31 + r(4) * 4;
  // 袍服 / 甲
  const robe = role === 'emperor' ? '#d8a531' : role === 'qingEmperor' ? '#e0b43a' : role === 'civil' ? (c.ab.wang > 60 ? '#a3281f' : '#2f5f8a') : role === 'qingOfficial' ? '#23344f'
    : role === 'scholar' ? '#4a5560' : role === 'rebel' ? '#5a4632' : role === 'child' ? '#e0b43a' : '#6d6f75';
  g.fillStyle = role === 'emperor' || role === 'qingEmperor' || role === 'child' ? robe : shade(robe, ((hashKeys(c.id + ':robe') % 100) / 100 - 0.5) * 0.5);
  g.beginPath(); g.moveTo(cx - 70, H); g.bezierCurveTo(cx - 66, 150, cx - 40, 134, cx - 16, 130); g.lineTo(cx + 16, 130); g.bezierCurveTo(cx + 40, 134, cx + 66, 150, cx + 70, H); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke();
  if (role === 'general' || role === 'qingGeneral' || role === 'rebel') {
    // 甲片
    g.strokeStyle = role === 'rebel' ? 'rgba(30,20,10,0.4)' : 'rgba(230,220,200,0.35)'; g.lineWidth = 1;
    for (let y = 142; y < H; y += 7) for (let x = cx - 60; x < cx + 60; x += 9) { g.beginPath(); g.arc(x + ((y / 7) % 2) * 4.5, y, 4.5, 0, Math.PI); g.stroke(); }
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
    if (role === 'civil') { g.fillStyle = 'rgba(240,210,130,0.85)'; g.fillRect(cx - 18, 168, 36, 26); g.strokeStyle = '#3a2a10'; g.lineWidth = 1; g.strokeRect(cx - 18, 168, 36, 26); g.beginPath(); g.arc(cx, 181, 7, 0, Math.PI * 2); g.stroke(); }
    if (role === 'emperor' || role === 'qingEmperor' || role === 'child') { g.strokeStyle = 'rgba(160,40,20,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(cx - 34, 172, 9, 0, Math.PI * 1.6); g.stroke(); g.beginPath(); g.arc(cx + 34, 172, 9, Math.PI, Math.PI * 2.6); g.stroke(); }
    if (role === 'qingOfficial') { g.fillStyle = '#1a2538'; g.beginPath(); g.ellipse(cx, 138, 40, 12, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(240,210,130,0.85)'; g.fillRect(cx - 16, 165, 32, 26); }
  }
  // 面貌：脸型、肤色、眉、眼、鼻、口、须、痣疤、皱纹各取一套，互不相关地由 id 决定——同一人每次一样，不同人很少撞脸
  const hv = (k: string) => hashKeys(c.id + ':' + k);
  const pick = <T,>(k: string, arr: T[]) => arr[hv(k) % arr.length];
  const fr = (k: string) => (hv(k) % 1000) / 1000;
  const skin = pick('skin', ['#e8c49a', '#dcb487', '#d2a77c', '#e3bd94', '#c99b70', '#efcfa8', '#d8ae86', '#bf9168']);
  const young = ['zhengsen', 'zhuyoulang', 'zhengjing', 'lilaiheng', 'lidingguo', 'xuanye', 'zhuyujian'].includes(c.id) || role === 'child';
  const old = !young && fr('age') < 0.3;
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
  const hairCol = old ? pick('grey', ['#8a8580', '#a9a49c', '#6f6a64']) : ink;
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
  switch (role) {
    case 'emperor': {
      g.fillStyle = '#16120e'; g.beginPath(); g.moveTo(cx - fw - 1, top + 12); g.quadraticCurveTo(cx, top - 26, cx + fw + 1, top + 12); g.closePath(); g.fill();
      g.fillStyle = '#16120e'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * 10, top - 14, 9, 13, sx * 0.5, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#d6b05a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - fw, top + 10); g.quadraticCurveTo(cx, top + 2, cx + fw, top + 10); g.stroke();
      g.fillStyle = '#d6b05a'; g.beginPath(); g.arc(cx, top - 4, 3, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'civil': {
      g.fillStyle = '#121010'; g.beginPath(); g.moveTo(cx - fw, top + 12); g.lineTo(cx - fw + 2, top - 4); g.quadraticCurveTo(cx, top - 14, cx + fw - 2, top - 4); g.lineTo(cx + fw, top + 12); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(cx, top - 10, 15, 11, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillRect(cx - fw - 30, top + 1, 30, 5); g.fillRect(cx + fw, top + 1, 30, 5); // 乌纱展角
      g.fillStyle = '#2a2420'; g.fillRect(cx - fw - 30, top + 1, 6, 5); g.fillRect(cx + fw + 24, top + 1, 6, 5);
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
