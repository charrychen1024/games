/* ============================================================
 * 烽烟录 · 第三部美术扩展：战船、七星坛、江面战斗背景
 * ============================================================ */
'use strict';
(function () {
  const A = G.art, T = G.T, TAU = G.TAU, sh = G.shade, ell = A.ell, circ = A.circ;

  /* ---------------- 地图道具 ---------------- */
  // 甲板（画在所有角色之下）：w×h 格，船头朝 dir（'left' / 'right'）
  function deckImg(p) {
    const key = `deck_${p.w}_${p.h}_${p.dir || 'right'}_${p.hull || ''}_${p.burnt ? 1 : 0}`;
    return A.mk(key, p.w * T + 60, p.h * T + 30, c => {
      const W = p.w * T, H = p.h * T, ox = 30, oy = 8;
      const hull = p.hull || '#5a3a22', right = (p.dir || 'right') === 'right';
      c.translate(ox, oy);
      if (!right) { c.translate(W, 0); c.scale(-1, 1); }
      // 船身外壳（下沿露出一截）
      c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, W / 2, H + 10, W * 0.55, 12);
      c.fillStyle = sh(hull, -0.3);
      c.beginPath(); c.moveTo(-6, 4); c.lineTo(W - 10, 4); c.quadraticCurveTo(W + 34, H * 0.5, W - 10, H + 14); c.lineTo(-6, H + 14); c.quadraticCurveTo(-22, H * 0.5, -6, 4); c.fill();
      c.fillStyle = hull;
      c.beginPath(); c.moveTo(-2, 0); c.lineTo(W - 12, 0); c.quadraticCurveTo(W + 26, H * 0.5, W - 12, H); c.lineTo(-2, H); c.quadraticCurveTo(-16, H * 0.5, -2, 0); c.fill();
      // 甲板木板
      c.save(); c.beginPath(); c.moveTo(4, 6); c.lineTo(W - 14, 6); c.quadraticCurveTo(W + 14, H * 0.5, W - 14, H - 6); c.lineTo(4, H - 6); c.quadraticCurveTo(-6, H * 0.5, 4, 6); c.clip();
      const deck = p.burnt ? '#5a4632' : '#b08a5a';
      c.fillStyle = deck; c.fillRect(-20, 0, W + 40, H);
      for (let y = 6; y < H; y += 12) { c.fillStyle = sh(deck, ((y / 12) % 2 ? -0.06 : 0.04)); c.fillRect(-20, y, W + 40, 11); c.fillStyle = 'rgba(40,25,10,0.35)'; c.fillRect(-20, y + 11, W + 40, 1); }
      for (let x = 30; x < W; x += 58) { c.fillStyle = 'rgba(40,25,10,0.25)'; c.fillRect(x, 0, 1, H); }
      if (p.burnt) { for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(20,12,8,0.4)'; ell(c, G.hash(i, p.w, 3) * W, G.hash(i, p.h, 4) * H, 14 + G.hash(i, 1, 5) * 20, 8 + G.hash(i, 2, 6) * 10); } }
      c.restore();
      // 船舷
      c.strokeStyle = sh(hull, -0.45); c.lineWidth = 4;
      c.beginPath(); c.moveTo(-2, 1); c.lineTo(W - 12, 1); c.quadraticCurveTo(W + 26, H * 0.5, W - 12, H - 1); c.lineTo(-2, H - 1); c.quadraticCurveTo(-16, H * 0.5, -2, 1); c.stroke();
      c.fillStyle = sh(hull, 0.15); for (let x = 8; x < W - 16; x += 22) { c.fillRect(x, -3, 5, 6); c.fillRect(x, H - 3, 5, 6); }
    });
  }
  // 桅杆与帆（参与深度排序）
  function drawMast(c, X, Y, p, t) {
    const h = p.mh || 150, col = p.sail || '#d8cbb0', burning = p.burning;
    c.fillStyle = 'rgba(0,0,0,0.2)'; ell(c, X + 4, Y, 10, 4);
    c.fillStyle = '#3a2614'; c.fillRect(X - 3, Y - h, 6, h);
    c.fillStyle = '#2a1a0e'; c.fillRect(X - 34, Y - h + 8, 68, 4);
    // 竹篾硬帆：分节
    const sw = burning ? 52 : 62, top = Y - h + 12, bot = Y - 44, sway = Math.sin(t * 1.6 + X) * 2;
    c.fillStyle = col; c.beginPath(); c.moveTo(X - sw / 2, top); c.lineTo(X + sw / 2, top); c.lineTo(X + sw / 2 + sway, bot); c.lineTo(X - sw / 2 + sway, bot); c.closePath(); c.fill();
    c.strokeStyle = sh(col, -0.35); c.lineWidth = 1.6;
    for (let y = top + 12; y < bot; y += 13) { c.beginPath(); c.moveTo(X - sw / 2, y); c.lineTo(X + sw / 2 + sway * (y - top) / (bot - top), y); c.stroke(); }
    c.strokeRect(X - sw / 2, top, sw, bot - top);
    if (p.text) G.text(c, p.text, X + sway / 2, (top + bot) / 2, { size: 26, bold: true, align: 'center', color: p.tcol || '#2a1a0e' });
    if (burning) { for (let i = 0; i < 3; i++) A.drawFire(c, X - 18 + i * 18, bot - i * 20, t + i, X + i); A.drawFire(c, X, Y - 4, t * 1.2, X * 3); }
  }
  // 七星坛：三层土台，插七星旗
  function altarImg() {
    return A.mk('altar', 6 * T + 40, 6 * T + 80, c => {
      c.translate(20, 70);
      const W = 6 * T;
      const tier = (y, inset, h, col) => { c.fillStyle = sh(col, -0.25); c.fillRect(inset, y + h - 8, W - inset * 2, 10); c.fillStyle = col; c.fillRect(inset, y, W - inset * 2, h - 8); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(inset, y, W - inset * 2, 3); };
      c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, W / 2, 6 * T - 4, W * 0.55, 18);
      tier(T * 2.4, 0, T * 3.6, '#8a6a44');
      tier(T * 1.2, T * 0.7, T * 1.6, '#9a7a50');
      tier(0, T * 1.5, T * 1.5, '#aa8a5a');
      // 台阶
      c.fillStyle = '#c8aa78'; for (let i = 0; i < 6; i++) c.fillRect(W / 2 - 22, T * 3.6 + i * 9, 44, 6);
      c.fillStyle = '#6a2a1a'; c.fillRect(W / 2 - 14, T * 0.35, 28, 18);
      c.fillStyle = '#d8b04a'; c.fillRect(W / 2 - 8, T * 0.35 - 10, 4, 10); c.fillRect(W / 2 + 4, T * 0.35 - 10, 4, 10);
    });
  }
  const STARS = [[0.6, 2.6], [5.4, 2.6], [0.9, 4.6], [5.1, 4.6], [1.8, 1.3], [4.2, 1.3], [3, 0.1]];

  const baseDraw = A.drawProp;
  A.drawProp = function (c, p, t) {
    const X = p.x * T, Y = p.y * T;
    if (p.type === 'deck') { const img = deckImg(p); c.drawImage(img, X - 30, Y - 8, img.lw, img.lh); return; }
    if (p.type === 'mast') { drawMast(c, X + T / 2, Y + T - 4, p, t); return; }
    if (p.type === 'altar') {
      const img = altarImg(); c.drawImage(img, X - 20, Y - 70, img.lw, img.lh);
      const wind = G.flag && G.flag('c11_wind') ? 1 : 0;
      STARS.forEach(([sx, sy], i) => {
        const fx = X + sx * T, fy = Y + sy * T, h = 70;
        c.fillStyle = '#3a2614'; c.fillRect(fx - 1.5, fy - h, 3, h);
        const dir = wind ? -1 : 1, wave = Math.sin(t * (wind ? 9 : 2.5) + i) * (wind ? 4 : 2);
        c.fillStyle = ['#2a3a6a', '#1a1a1a', '#8a1e1e', '#e8e0c8', '#c8a02a', '#2a6a3a', '#5a2a6a'][i];
        c.beginPath(); c.moveTo(fx, fy - h + 2); c.lineTo(fx + dir * (wind ? 34 : 14) + wave, fy - h + 8); c.lineTo(fx + dir * (wind ? 32 : 12) + wave, fy - h + 30); c.lineTo(fx, fy - h + 28); c.fill();
      });
      return;
    }
    baseDraw(c, p, t);
  };

  /* ---------------- 江面战斗背景 ---------------- */
  Object.assign(A.BG, {
    river: { sky: ['#8a9aa8', '#c4ccd0', '#e4e2d8'], sun: [720, 120, 26, '#fffbe8', 'rgba(255,250,230,0.5)'], cloud: 'rgba(255,255,255,0.4)', ridges: ['#9aa8b0', '#8a9a98', '#7a8a84'], mist: 'rgba(240,242,240,0.7)', water: ['#6a8494', '#3a5464'], deck: '#a8825a', fog: true },
    fog: { sky: ['#b8bec2', '#d4d8d8', '#e8e8e4'], sun: null, cloud: 'rgba(255,255,255,0.5)', ridges: ['#c0c6c8', '#b4bcbc', '#a8b2b2'], mist: 'rgba(245,246,245,0.85)', water: ['#8a9ca4', '#5a6c74'], deck: '#9a7a54', fog: true },
    chibi: { sky: ['#140a12', '#4a1610', '#d0501e'], sun: null, cloud: 'rgba(40,15,10,0.5)', ridges: ['#2a1410', '#22100e', '#1a0c0a'], mist: 'rgba(230,110,40,0.35)', water: ['#4a2a20', '#140c0c'], deck: '#6a4a30', embers: true, burning: true },
  });
  const baseBg = A.battleBg;
  A.battleBg = function (kind) {
    const cfg = A.BG[kind];
    if (!cfg || !cfg.water) return baseBg(kind);
    const W = G.W, H = G.H;
    return A.mk('bbg_' + kind, W, H, c => {
      const rng = G.seeded(kind.length * 131 + 7), hor = 236;
      let g = c.createLinearGradient(0, 0, 0, hor);
      g.addColorStop(0, cfg.sky[0]); g.addColorStop(0.6, cfg.sky[1]); g.addColorStop(1, cfg.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, hor + 4);
      if (cfg.sun) { const [sx, sy, sr, col, glow] = cfg.sun; g = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 5); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(255,240,220,0)'); c.fillStyle = g; c.fillRect(0, 0, W, hor); c.fillStyle = col; circ(c, sx, sy, sr); }
      for (let i = 0; i < 9; i++) { const cx = rng() * W, cy = 20 + rng() * 120, w = 80 + rng() * 160; c.fillStyle = cfg.cloud; for (let k = 0; k < 6; k++) ell(c, cx + (k - 3) * w * 0.16, cy + Math.sin(k) * 4, w * 0.18, 10 + rng() * 8); }
      // 远山（对岸）
      const ridge = (y0, amp, seed, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, hor); for (let x = 0; x <= W; x += 6) c.lineTo(x, y0 - G.fbm(x / 160, seed, seed) * amp); c.lineTo(W, hor); c.closePath(); c.fill(); };
      ridge(200, 80, 11, cfg.ridges[0]); ridge(222, 40, 12, cfg.ridges[1]);
      // 江面
      g = c.createLinearGradient(0, hor, 0, H); g.addColorStop(0, cfg.water[0]); g.addColorStop(1, cfg.water[1]);
      c.fillStyle = g; c.fillRect(0, hor, W, H - hor);
      // 远处船队（连环船）
      for (let i = 0; i < 11; i++) {
        const x = 30 + i * 88 + rng() * 20, y = hor + 6 + rng() * 6, s = 0.5 + rng() * 0.3;
        c.fillStyle = cfg.burning ? '#1a0c08' : sh(cfg.ridges[1], -0.35);
        c.beginPath(); c.moveTo(x - 36 * s, y); c.lineTo(x + 36 * s, y); c.lineTo(x + 26 * s, y + 10 * s); c.lineTo(x - 26 * s, y + 10 * s); c.fill();
        c.fillRect(x - 1.5, y - 60 * s, 3, 60 * s);
        c.fillRect(x - 16 * s, y - 56 * s, 32 * s, 38 * s);
        if (cfg.burning && i % 2 === 0) { g = c.createRadialGradient(x, y - 30 * s, 0, x, y - 30 * s, 70 * s); g.addColorStop(0, 'rgba(255,170,60,0.85)'); g.addColorStop(0.4, 'rgba(230,80,20,0.5)'); g.addColorStop(1, 'rgba(200,40,10,0)'); c.fillStyle = g; c.fillRect(x - 80, y - 110, 160, 130); }
      }
      // 雾
      g = c.createLinearGradient(0, hor - 50, 0, hor + 40); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, cfg.mist); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, hor - 50, W, 90);
      // 波纹
      c.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const y = hor + 8 + Math.pow(rng(), 0.9) * (H - hor), x = rng() * W, s = (y - hor) / (H - hor);
        c.strokeStyle = cfg.burning ? `rgba(255,${120 + rng() * 80 | 0},60,${0.15 + s * 0.3})` : `rgba(230,240,245,${0.12 + s * 0.25})`;
        c.lineWidth = 0.8 + s * 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8 + s * 26, y); c.stroke();
      }
      // 近处：我方船头甲板（左下）与敌船船舷（右侧）
      const deck = cfg.deck;
      c.fillStyle = sh(deck, -0.35);
      c.beginPath(); c.moveTo(0, 300); c.lineTo(460, 330); c.quadraticCurveTo(560, 420, 470, H); c.lineTo(0, H); c.fill();
      c.fillStyle = deck;
      c.beginPath(); c.moveTo(0, 312); c.lineTo(450, 340); c.quadraticCurveTo(540, 424, 460, H); c.lineTo(0, H); c.fill();
      for (let y = 330; y < H; y += 18) { c.fillStyle = 'rgba(40,25,10,0.28)'; c.fillRect(0, y, 520, 1.5); }
      c.fillStyle = sh(deck, -0.3);
      c.beginPath(); c.moveTo(960, 286); c.lineTo(560, 320); c.quadraticCurveTo(470, 420, 540, H); c.lineTo(960, H); c.fill();
      c.fillStyle = sh(deck, -0.08);
      c.beginPath(); c.moveTo(960, 298); c.lineTo(570, 330); c.quadraticCurveTo(486, 424, 552, H); c.lineTo(960, H); c.fill();
      for (let y = 320; y < H; y += 18) { c.fillStyle = 'rgba(40,25,10,0.28)'; c.fillRect(520, y, 440, 1.5); }
      // 船舷护栏
      c.fillStyle = sh(deck, -0.5);
      for (let x = 0; x < 450; x += 26) c.fillRect(x, 300 + x * 0.066 - 18, 5, 22);
      c.fillRect(0, 296, 452, 4);
      for (let x = 566; x < 960; x += 26) c.fillRect(x, 286 + (960 - x) * 0.087 - 18, 5, 22);
      if (cfg.burning) {
        g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,90,30,0.0)'); g.addColorStop(1, 'rgba(255,90,30,0.18)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      g = c.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, W * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
  };
})();
