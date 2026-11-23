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
  g.fillStyle = robe;
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
  // 脖子、脸
  const skin = ['#e8c49a', '#dcb487', '#d2a77c', '#e3bd94'][h % 4];
  g.fillStyle = shade(skin, -0.12); g.fillRect(cx - 10, faceY + fh - 8, 20, 22);
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(cx, faceY, fw, fh, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(60,35,15,0.55)'; g.lineWidth = 1.2; g.stroke();
  // 耳
  g.fillStyle = skin; g.beginPath(); g.ellipse(cx - fw + 1, faceY + 2, 4, 7, 0, 0, Math.PI * 2); g.ellipse(cx + fw - 1, faceY + 2, 4, 7, 0, 0, Math.PI * 2); g.fill();
  // 眉眼
  const ink = '#1e140c';
  const brow = role === 'general' || role === 'qingGeneral' || role === 'rebel' ? 3 : 2;
  const tilt = (role.includes('eneral') || role === 'rebel' ? -3 : 1) + (r(5) - 0.5) * 2;
  g.strokeStyle = ink; g.lineCap = 'round';
  g.lineWidth = brow;
  g.beginPath(); g.moveTo(cx - 17, faceY - 9 + tilt * 0.3); g.lineTo(cx - 5, faceY - 11 - tilt * 0.5); g.stroke();
  g.beginPath(); g.moveTo(cx + 17, faceY - 9 + tilt * 0.3); g.lineTo(cx + 5, faceY - 11 - tilt * 0.5); g.stroke();
  g.lineWidth = 1.8;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 16, faceY - 3); g.quadraticCurveTo(cx + sx * 11, faceY - 6, cx + sx * 6, faceY - 3); g.stroke(); g.fillStyle = ink; g.beginPath(); g.arc(cx + sx * 11, faceY - 3.5, 1.6, 0, Math.PI * 2); g.fill(); }
  // 鼻口
  g.lineWidth = 1.3; g.strokeStyle = 'rgba(60,35,15,0.8)';
  g.beginPath(); g.moveTo(cx - 1, faceY - 2); g.lineTo(cx - 3, faceY + 9); g.lineTo(cx + 2, faceY + 10); g.stroke();
  g.beginPath(); g.moveTo(cx - 6, faceY + 17); g.quadraticCurveTo(cx, faceY + 18 + (r(6) - 0.5) * 3, cx + 6, faceY + 17); g.stroke();
  // 胡须：年轻者无须；武将络腮，文臣三绺长须
  const young = ['zhengsen', 'zhuyoulang', 'zhengjing', 'lilaiheng', 'lidingguo', 'xuanye'].includes(c.id) || role === 'child';
  if (!young) {
    g.strokeStyle = ink; g.fillStyle = ink;
    const style = role === 'general' || role === 'rebel' || role === 'qingGeneral' ? (r(7) > 0.4 ? 'full' : 'mus') : r(7) > 0.3 ? 'long' : 'mus';
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 9, faceY + 14); g.quadraticCurveTo(cx - 3, faceY + 11, cx, faceY + 13); g.quadraticCurveTo(cx + 3, faceY + 11, cx + 9, faceY + 14); g.stroke();
    if (style === 'long') { g.lineWidth = 1.2; for (const dx of [-5, 0, 5]) { g.beginPath(); g.moveTo(cx + dx, faceY + 21); g.quadraticCurveTo(cx + dx * 1.3, faceY + 34, cx + dx * 0.8, faceY + 46 + r(8) * 6); g.stroke(); } }
    if (style === 'full') { g.globalAlpha = 0.85; g.beginPath(); g.moveTo(cx - fw + 3, faceY + 4); g.quadraticCurveTo(cx - fw + 2, faceY + 30, cx, faceY + 36); g.quadraticCurveTo(cx + fw - 2, faceY + 30, cx + fw - 3, faceY + 4); g.quadraticCurveTo(cx + 12, faceY + 22, cx, faceY + 21); g.quadraticCurveTo(cx - 12, faceY + 22, cx - fw + 3, faceY + 4); g.fill(); g.globalAlpha = 1; }
  }
  if (role === 'qingGeneral' || role === 'qingOfficial' || role === 'qingEmperor' || role === 'child') {
    // 剃发：前额青色
    g.fillStyle = 'rgba(80,90,85,0.35)'; g.beginPath(); g.ellipse(cx, faceY - fh + 8, fw - 3, 10, 0, Math.PI, Math.PI * 2); g.fill();
  }
  // 冠帽
  const top = faceY - fh;
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
      g.fillStyle = '#1c1c22'; g.beginPath(); g.moveTo(cx - fw + 1, top + 12); g.lineTo(cx - fw + 4, top - 22); g.lineTo(cx + fw - 4, top - 22); g.lineTo(cx + fw - 1, top + 12); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(cx, top - 21); g.lineTo(cx, top + 10); g.stroke();
      break;
    }
    case 'general': {
      g.fillStyle = '#8a8d93'; g.beginPath(); g.ellipse(cx, top + 6, fw + 3, 22, 0, Math.PI, Math.PI * 2); g.fill();
      g.strokeStyle = '#3c3e42'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#b8bcc2'; g.fillRect(cx - fw - 3, top + 4, (fw + 3) * 2, 6);
      for (const sx of [-1, 1]) { g.fillStyle = '#d6b05a'; g.beginPath(); g.moveTo(cx + sx * (fw - 2), top - 4); g.quadraticCurveTo(cx + sx * (fw + 16), top - 22, cx + sx * (fw + 10), top - 2); g.closePath(); g.fill(); } // 凤翅
      g.fillStyle = '#c8352a'; g.beginPath(); g.moveTo(cx, top - 16); g.quadraticCurveTo(cx - 6, top - 34, cx + 4, top - 44); g.quadraticCurveTo(cx + 6, top - 30, cx + 3, top - 16); g.fill(); // 红缨
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
