/* ============================================================
 * 烽烟录 · 第四部美术扩展：试剑石、石碑、栈道；蜀道 / 落凤坡战斗背景
 * ============================================================ */
'use strict';
(function () {
  const A = G.art, T = G.T, sh = G.shade, ell = A.ell, circ = A.circ;

  /* ---------------- 地图道具 ---------------- */
  // 试剑石：一块巨石；刘备、孙权各砍一剑后裂成十字
  function stoneImg(split) {
    return A.mk('jianshi_' + (split ? 1 : 0), 2 * T + 40, 2 * T + 60, c => {
      c.translate(20, 50);
      const W = 2 * T, H = 2 * T;
      c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, W / 2, H - 6, W * 0.55, 12);
      const body = (dx, dy, clip) => {
        c.save(); c.translate(dx, dy);
        if (clip) { c.beginPath(); clip(c); c.clip(); }
        c.fillStyle = '#6e6a62';
        c.beginPath(); c.moveTo(6, H - 6); c.quadraticCurveTo(-6, H * 0.4, 18, 0); c.quadraticCurveTo(W * 0.5, -22, W - 14, 4); c.quadraticCurveTo(W + 8, H * 0.5, W - 4, H - 6); c.closePath(); c.fill();
        c.fillStyle = '#8a857a'; c.beginPath(); c.moveTo(18, 4); c.quadraticCurveTo(W * 0.5, -16, W - 18, 8); c.quadraticCurveTo(W * 0.5, 14, 18, 4); c.fill();
        c.fillStyle = 'rgba(40,36,30,0.35)'; for (let i = 0; i < 12; i++) ell(c, 10 + G.hash(i, 3, 7) * (W - 20), 10 + G.hash(i, 4, 7) * (H - 24), 3 + G.hash(i, 5, 7) * 5, 2 + G.hash(i, 6, 7) * 3);
        c.fillStyle = 'rgba(90,120,70,0.55)'; for (let i = 0; i < 5; i++) ell(c, 8 + G.hash(i, 8, 7) * (W - 16), H - 14 - G.hash(i, 9, 7) * 18, 7, 3);
        c.restore();
      };
      if (!split) { body(0, 0); return; }
      const cx = W / 2, cy = H * 0.45;
      body(-4, -2, k => k.rect(-20, -40, cx + 20, cy + 40));
      body(4, -2, k => k.rect(cx, -40, W, cy + 40));
      body(-4, 3, k => k.rect(-20, cy, cx + 20, H));
      body(4, 3, k => k.rect(cx, cy, W, H));
      c.strokeStyle = 'rgba(255,250,230,0.5)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(cx, -10); c.lineTo(cx, H - 4); c.moveTo(-4, cy); c.lineTo(W + 4, cy); c.stroke();
    });
  }
  // 石碑：龟趺 + 碑身 + 刻字
  function steleImg(text) {
    return A.mk('stele_' + text, 100, 140, c => {
      c.translate(50, 132);
      c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, 4, 0, 34, 8);
      c.fillStyle = '#5e5a52'; ell(c, 0, -10, 30, 12); c.fillStyle = '#6e6a60'; ell(c, -22, -12, 8, 6);
      c.fillStyle = '#7a766c'; c.fillRect(-18, -104, 36, 92);
      c.fillStyle = '#8a867a'; c.fillRect(-18, -104, 36, 4);
      c.fillStyle = '#6a665c'; c.beginPath(); c.moveTo(-22, -104); c.quadraticCurveTo(0, -126, 22, -104); c.fill();
      const chars = [...text];
      chars.forEach((ch, i) => G.text(c, ch, 0, -88 + i * 19, { size: 16, bold: true, align: 'center', color: '#2a2620' }));
    });
  }

  const baseDraw = A.drawProp;
  A.drawProp = function (c, p, t) {
    const X = p.x * T, Y = p.y * T;
    if (p.type === 'jianshi') { const img = stoneImg(p.split || (p.splitFlag && G.flag(p.splitFlag))); c.drawImage(img, X - 20, Y - 50, img.lw, img.lh); return; }
    if (p.type === 'stele') { const img = steleImg(p.text || '碑'); c.drawImage(img, X + T / 2 - 50, Y + T - 132, img.lw, img.lh); return; }
    if (p.type === 'lamps') { // 七星灯：七盏大灯如北斗，外布四十九盏小灯；主灯熄灭后变暗
      const cx = X + p.w * T / 2, cy = Y + p.h * T / 2, out = p.outFlag && G.flag(p.outFlag);
      const lamp = (x, y, r, main) => {
        const lit = !(main && out);
        if (lit) { const g = c.createRadialGradient(x, y - 6, 0, x, y - 6, r * 4); g.addColorStop(0, 'rgba(255,220,140,0.55)'); g.addColorStop(1, 'rgba(255,180,80,0)'); c.fillStyle = g; c.fillRect(x - r * 4, y - 6 - r * 4, r * 8, r * 8); }
        c.fillStyle = '#5a4a2a'; c.fillRect(x - r * 0.6, y - 2, r * 1.2, 4);
        c.fillStyle = '#8a6a3a'; ell(c, x, y - 3, r, r * 0.45);
        if (lit) { c.fillStyle = '#ffe2a0'; ell(c, x, y - 7 + Math.sin(t * 8 + x) * 0.6, r * 0.32, r * 0.7); c.fillStyle = '#fff6d8'; ell(c, x, y - 7, r * 0.14, r * 0.35); }
        else { c.strokeStyle = 'rgba(200,200,200,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 6); c.quadraticCurveTo(x + 4, y - 14 - (t * 10 % 8), x - 2, y - 22); c.stroke(); }
      };
      for (let i = 0; i < 49; i++) { const a = (i / 49) * Math.PI * 2; lamp(cx + Math.cos(a) * p.w * T * 0.46, cy + Math.sin(a) * p.h * T * 0.4, 4, false); }
      const D = [[-1.6, -0.6], [-0.9, -0.8], [-0.2, -0.5], [0.4, -0.2], [0.6, 0.5], [1.4, 0.6], [1.5, -0.2]];
      D.forEach(([dx, dy], i) => lamp(cx + dx * T, cy + dy * T, 7, false));
      lamp(cx, cy + T * 0.2, 11, true);
      return;
    }
    if (p.type === 'coffin') { // 庞德抬榇：黑漆棺木
      const x = X + 4, y = Y + T - 8, w = p.w * T - 8;
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, x + w / 2, y + 2, w * 0.55, 6);
      c.fillStyle = '#5a3a1e'; c.fillRect(x + 4, y - 6, 4, 8); c.fillRect(x + w - 8, y - 6, 4, 8);
      c.fillStyle = '#1e1614'; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + w, y - 10); c.lineTo(x + w, y - 34); c.lineTo(x, y - 30); c.closePath(); c.fill();
      c.fillStyle = '#2e2420'; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x + w, y - 34); c.lineTo(x + w - 6, y - 40); c.lineTo(x + 4, y - 36); c.closePath(); c.fill();
      c.fillStyle = '#c9a24a'; c.fillRect(x + w * 0.45, y - 28, 10, 14);
      G.text(c, '奠', x + w * 0.45 + 5, y - 21, { size: 11, bold: true, align: 'center', color: '#1e1614' });
      return;
    }
    if (p.type === 'arrows') { // 插满地面的箭（落凤坡）
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const ax = X + G.hash(p.x, i, 3) * T * p.w, ay = Y + G.hash(p.y, i, 4) * T * p.h + 10, a = -0.4 + G.hash(i, p.x, 5) * 0.8;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + Math.sin(a) * 18, ay - Math.cos(a) * 18); c.stroke();
        c.fillStyle = '#e8e0c8'; c.fillRect(ax + Math.sin(a) * 18 - 2, ay - Math.cos(a) * 18 - 2, 4, 4);
      }
      return;
    }
    baseDraw(c, p, t);
  };

  /* ---------------- 战斗背景：蜀道群峰 / 落凤坡 ---------------- */
  Object.assign(A.BG, {
    shu: { peaks: true, sky: ['#7a9ab0', '#b8ccc8', '#e4e4d0'], sun: [220, 90, 24, '#fffbe8', 'rgba(255,250,230,0.55)'], cloud: 'rgba(255,255,255,0.55)', rock: ['#8a9a90', '#6a7e6e', '#4a5e4a'], mist: 'rgba(240,244,240,0.7)', ground: ['#7a7a52', '#3e4428'], tree: '#2e4a2a', plank: true },
    gorge: { peaks: true, sky: ['#2a1a22', '#6a3a30', '#c87a40'], sun: [480, 230, 34, '#ffb070', 'rgba(255,150,80,0.5)'], cloud: 'rgba(70,30,30,0.4)', rock: ['#4a3a38', '#36282a', '#22181a'], mist: 'rgba(200,110,70,0.35)', ground: ['#5a4430', '#22180e'], tree: '#1a1410', narrow: true, arrows: true },
    yiling: { peaks: true, sky: ['#1a0a0a', '#5a1a10', '#d86a24'], sun: null, cloud: 'rgba(40,20,15,0.6)', rock: ['#3a2420', '#2a1a16', '#1a100e'], mist: 'rgba(240,120,40,0.4)', ground: ['#4a3020', '#1a0e08'], tree: '#140a06', burning: true },
    jiameng: { peaks: true, sky: ['#0e1426', '#26304a', '#4a4a5a'], sun: [760, 80, 20, '#f0ecd8', 'rgba(220,220,200,0.35)'], cloud: 'rgba(30,36,60,0.5)', rock: ['#3a4250', '#2a3040', '#1a2030'], mist: 'rgba(120,130,160,0.3)', ground: ['#3a3a34', '#16161a'], tree: '#141a1a', torches: true, wall: true },
  });
  const baseBg = A.battleBg;
  A.battleBg = function (kind) {
    const cfg = A.BG[kind];
    if (!cfg || !cfg.peaks) return baseBg(kind);
    const W = G.W, H = G.H;
    return A.mk('bbg_' + kind, W, H, c => {
      const rng = G.seeded(kind.length * 173 + 11), hor = 268;
      let g = c.createLinearGradient(0, 0, 0, hor);
      g.addColorStop(0, cfg.sky[0]); g.addColorStop(0.6, cfg.sky[1]); g.addColorStop(1, cfg.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, hor + 4);
      if (cfg.sun) { const [sx, sy, sr, col, glow] = cfg.sun; g = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 6); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(255,220,180,0)'); c.fillStyle = g; c.fillRect(0, 0, W, hor); c.fillStyle = col; circ(c, sx, sy, sr); }
      if (cfg.torches) for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,240,${rng() * 0.7})`; c.fillRect(rng() * W, rng() * 160, 1.4, 1.4); }
      for (let i = 0; i < 8; i++) { const cx = rng() * W, cy = 30 + rng() * 110, w = 90 + rng() * 150; c.fillStyle = cfg.cloud; for (let k = 0; k < 6; k++) ell(c, cx + (k - 3) * w * 0.16, cy + Math.sin(k) * 4, w * 0.18, 9 + rng() * 7); }
      // 尖峭群峰：三层，越近越深
      const peaks = (base, hmin, hmax, wmin, wmax, col, seed, edgeOnly) => {
        const r = G.seeded(seed);
        for (let x = -60; x < W + 60;) {
          const w = wmin + r() * (wmax - wmin), h = hmin + r() * (hmax - hmin), cx = x + w / 2;
          if (edgeOnly && cx > W * 0.3 && cx < W * 0.7) { x += w * 0.6; continue; }
          c.fillStyle = col;
          c.beginPath(); c.moveTo(x, base);
          c.quadraticCurveTo(x + w * 0.18, base - h * 0.55, cx - w * 0.06, base - h);
          c.quadraticCurveTo(cx + w * 0.08, base - h * 1.02, cx + w * 0.12, base - h * 0.92);
          c.quadraticCurveTo(x + w * 0.85, base - h * 0.5, x + w, base); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.beginPath(); c.moveTo(cx - w * 0.06, base - h); c.quadraticCurveTo(x + w * 0.2, base - h * 0.5, x + w * 0.12, base); c.lineTo(x + w * 0.3, base); c.closePath(); c.fill();
          // 崖上松
          for (let k = 0; k < 3; k++) { const tx = cx - w * 0.2 + r() * w * 0.4, ty = base - h * (0.4 + r() * 0.5); c.fillStyle = cfg.tree; ell(c, tx, ty, 7, 4); ell(c, tx + 3, ty - 4, 5, 3); }
          x += w * (0.55 + r() * 0.3);
        }
      };
      peaks(hor - 20, 120, 220, 90, 160, cfg.rock[0], 3, false);
      g = c.createLinearGradient(0, hor - 110, 0, hor); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, cfg.mist); c.fillStyle = g; c.fillRect(0, hor - 110, W, 110);
      peaks(hor, 90, 170, 110, 190, cfg.rock[1], 5, false);
      if (cfg.narrow) peaks(H - 120, 280, 380, 180, 260, cfg.rock[2], 9, true);
      if (cfg.wall) { // 关墙
        const wc = sh(cfg.rock[1], -0.2); c.fillStyle = wc; c.fillRect(0, hor - 56, W, 60);
        for (let x = 0; x < W; x += 22) c.fillRect(x, hor - 66, 14, 12);
        c.fillStyle = sh(wc, -0.3); c.fillRect(W * 0.5 - 90, hor - 120, 180, 50);
        c.beginPath(); c.moveTo(W * 0.5 - 112, hor - 116); c.quadraticCurveTo(W * 0.5, hor - 136, W * 0.5 + 112, hor - 116); c.lineTo(W * 0.5 + 70, hor - 150); c.lineTo(W * 0.5 - 70, hor - 150); c.closePath(); c.fill();
        G.text(c, '葭萌关', W * 0.5, hor - 96, { size: 20, bold: true, align: 'center', color: '#c9a24a' });
      }
      // 地面
      g = c.createLinearGradient(0, hor, 0, H); g.addColorStop(0, cfg.ground[0]); g.addColorStop(1, cfg.ground[1]);
      c.fillStyle = g; c.fillRect(0, hor, W, H - hor);
      if (cfg.plank) { // 远处栈道
        c.fillStyle = '#5a4026';
        for (let x = 0; x < W; x += 16) { const y = hor - 70 + Math.sin(x / 140) * 18; c.fillRect(x, y, 13, 4); c.fillRect(x + 4, y + 4, 2, 14); }
      }
      c.lineCap = 'round';
      for (let i = 0; i < 700; i++) {
        const y = hor + 2 + Math.pow(rng(), 0.8) * (H - hor), x = rng() * W, s = (y - hor) / (H - hor);
        c.strokeStyle = `rgba(${cfg.torches ? '90,90,80' : '150,140,90'},${0.25 + s * 0.3})`; c.lineWidth = 0.8 + s * 1.4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rng() - 0.5) * 5, y - 3 - s * 10); c.stroke();
      }
      for (let i = 0; i < 50; i++) { const x = rng() * W, y = hor + 20 + rng() * 240, s = (y - hor) / 270; c.fillStyle = 'rgba(60,55,50,0.6)'; ell(c, x, y, 4 + s * 8, 2 + s * 4); }
      if (cfg.arrows) { // 地上插满箭
        c.strokeStyle = 'rgba(40,28,18,0.85)';
        for (let i = 0; i < 70; i++) { const x = rng() * W, y = hor + 30 + rng() * 240, a = -0.5 + rng(); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * 20, y - Math.cos(a) * 20); c.stroke(); c.fillStyle = '#e0d8c0'; c.fillRect(x + Math.sin(a) * 20 - 2, y - Math.cos(a) * 20 - 2, 4, 3); }
      }
      if (cfg.burning) { // 七百里连营：林火
        for (let i = 0; i < 26; i++) { const x = i * 40 + rng() * 20, y = hor - 4 + rng() * 10; g = c.createRadialGradient(x, y - 30, 0, x, y - 30, 90); g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(220,60,10,0)'); c.fillStyle = g; c.fillRect(x - 90, y - 120, 180, 180); }
        for (let i = 0; i < 18; i++) A.drawFire(c, 20 + i * 54 + rng() * 20, hor + 4 + rng() * 6, i * 0.7, i * 13);
        for (let i = 0; i < 6; i++) A.drawFire(c, rng() * W, hor + 40 + rng() * 150, i * 1.3, i * 31 + 7);
        g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,90,30,0)'); g.addColorStop(1, 'rgba(255,90,30,0.2)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      if (cfg.torches) { // 火把与暖光
        for (const x of [70, 250, 710, 890]) {
          g = c.createRadialGradient(x, hor + 10, 0, x, hor + 10, 160); g.addColorStop(0, 'rgba(255,170,80,0.45)'); g.addColorStop(1, 'rgba(255,120,40,0)');
          c.fillStyle = g; c.fillRect(x - 160, hor - 150, 320, 320);
          c.fillStyle = '#3a2614'; c.fillRect(x - 2, hor - 40, 4, 50);
          A.drawFire(c, x, hor - 38, 0.4 + x, x);
        }
      }
      g = c.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, W * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${cfg.torches ? 0.6 : 0.45})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
  };
})();
