/* ============================================================
 * 烽烟录 · 程序化美术：人物、树木、建筑、地表、战斗背景
 * 所有画面均由代码实时绘制或预渲染，不依赖任何图片素材。
 * ============================================================ */
'use strict';
(function () {
  const T = G.T, TAU = G.TAU, sh = G.shade;
  const A = (G.art = {});
  const cache = {};
  function mk(key, w, h, fn, R) {
    if (cache[key]) return cache[key];
    R = R || 2;
    const c = G.makeCanvas(w * R, h * R), x = c.getContext('2d');
    x.scale(R, R); fn(x, w, h);
    c.lw = w; c.lh = h; cache[key] = c; return c;
  }
  A.mk = mk;
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fill(); };
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); c.fill(); };
  const tri = (c, a, b, d, e, f, g) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.lineTo(f, g); c.closePath(); c.fill(); };
  A.circ = circ; A.ell = ell;

  /* ==========================================================
   * 人物（Q 版，脚底为原点，高约 46px）
   * ========================================================== */
  A.drawChar = function (c, s, dir, step = 0, opt = {}) {
    const sc = (s.size || 1) * (opt.scale || 1);
    c.save();
    c.scale(sc, sc);
    if (!opt.noShadow) { c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, 0, 0, 13, 4.5); }
    const walk = step === 1 ? 1 : step === 3 ? -1 : 0;
    if (dir === 'left') c.scale(-1, 1);
    c.translate(0, walk ? -1.3 : 0);
    if (opt.down) { c.translate(0, 8); c.rotate(-0.12); }
    if (dir === 'left' || dir === 'right') drawSide(c, s, walk, opt); else drawFront(c, s, dir === 'up', walk, opt);
    c.restore();
  };

  function drawLegs(c, s, walk, side) {
    const pants = s.pants || '#3a3029', boot = s.boot || '#1d1916';
    if (side) {
      for (const k of [-1, 1]) {
        const off = walk * 3 * k;
        c.fillStyle = k < 0 ? sh(pants, -0.25) : pants;
        c.fillRect(-3 + off, -10, 5, 9);
        c.fillStyle = boot; G.rr(c, -3.5 + off, -3, 7, 3.5, 1.5); c.fill();
      }
    } else {
      const l = walk > 0 ? 2 : 0, r = walk < 0 ? 2 : 0;
      c.fillStyle = pants; c.fillRect(-6, -10 - l, 5, 9); c.fillRect(1, -10 - r, 5, 9);
      c.fillStyle = boot; G.rr(c, -6.5, -3 - l, 6, 3.5, 1.5); c.fill(); G.rr(c, 0.5, -3 - r, 6, 3.5, 1.5); c.fill();
    }
  }

  function robePath(c, top, hem, wTop, wHem) {
    c.beginPath();
    c.moveTo(-wTop, top);
    c.quadraticCurveTo(-wTop - 2, (top + hem) / 2, -wHem, hem);
    c.quadraticCurveTo(0, hem + 2, wHem, hem);
    c.quadraticCurveTo(wTop + 2, (top + hem) / 2, wTop, top);
    c.closePath();
  }

  function drawFront(c, s, back, walk, opt) {
    const robe = s.robe;
    const sw = walk * 2;
    if (back && s.weapon) drawWeapon(c, s, -12, -13 + sw, true);
    if (s.cape) { c.fillStyle = s.cape; robePath(c, -25, -3, 11, 15); c.fill(); }
    drawLegs(c, s, walk, false);
    // 袍身
    const gr = c.createLinearGradient(-13, 0, 13, 0);
    gr.addColorStop(0, sh(robe, 0.15)); gr.addColorStop(0.55, robe); gr.addColorStop(1, sh(robe, -0.35));
    c.fillStyle = gr; robePath(c, -25, -6, 9.5, 12.5); c.fill();
    c.strokeStyle = sh(robe, -0.55); c.lineWidth = 0.8; c.stroke();
    // 下摆滚边
    c.strokeStyle = s.trim; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-12, -7); c.quadraticCurveTo(0, -4.5, 12, -7); c.stroke();
    if (!back) {
      // 交领
      c.strokeStyle = s.robe2 || s.trim; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-6, -25); c.lineTo(3.5, -15.5); c.moveTo(6, -25); c.lineTo(0.5, -19.5); c.stroke();
      c.lineCap = 'butt';
    }
    if (s.armor) {
      c.fillStyle = s.armor; G.rr(c, -8.5, -24, 17, 11, 3); c.fill();
      c.strokeStyle = sh(s.armor, -0.4); c.lineWidth = 0.7;
      for (let y = -21; y < -13; y += 2.6) { c.beginPath(); c.moveTo(-8, y); c.lineTo(8, y); c.stroke(); }
      c.fillStyle = sh(s.armor, 0.25); ell(c, -10, -23, 4.5, 3.2, -0.3); ell(c, 10, -23, 4.5, 3.2, 0.3);
      if (!back && s.armorMark) { c.fillStyle = s.armorMark; circ(c, 0, -19, 2.4); }
    }
    // 腰带
    c.fillStyle = s.belt || sh(s.trim, -0.25); c.fillRect(-10, -15.5, 20, 3);
    if (!back) { c.fillStyle = sh(s.trim, 0.3); c.fillRect(-1.5, -15.5, 3, 3); }
    // 手臂
    c.fillStyle = sh(robe, -0.12);
    ell(c, -11.5, -18 + sw, 3.6, 6.5, 0.15); ell(c, 11.5, -18 - sw, 3.6, 6.5, -0.15);
    c.fillStyle = s.skin; circ(c, -12, -12 + sw, 2.6); circ(c, 12, -12 - sw, 2.6);
    drawHead(c, s, back ? 'up' : 'down');
    if (!back && s.weapon) drawWeapon(c, s, 12.5, -12.5 - sw, false);
  }

  function drawSide(c, s, walk, opt) {
    const robe = s.robe;
    // 后臂
    c.fillStyle = sh(robe, -0.35); ell(c, -2 - walk * 2, -18, 3.4, 6.3, 0.2 * walk);
    if (s.cape) { c.fillStyle = s.cape; c.beginPath(); c.moveTo(-6, -25); c.quadraticCurveTo(-14, -12, -13 - Math.abs(walk), -3); c.lineTo(2, -5); c.closePath(); c.fill(); }
    drawLegs(c, s, walk, true);
    const gr = c.createLinearGradient(-10, 0, 10, 0);
    gr.addColorStop(0, sh(robe, -0.3)); gr.addColorStop(0.6, robe); gr.addColorStop(1, sh(robe, 0.12));
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(-6, -25); c.quadraticCurveTo(-9, -15, -10, -6); c.quadraticCurveTo(0, -4, 10, -6); c.quadraticCurveTo(8, -15, 6, -25); c.closePath(); c.fill();
    c.strokeStyle = sh(robe, -0.55); c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = s.trim; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-9.5, -7); c.quadraticCurveTo(0, -5, 9.5, -7); c.stroke();
    c.strokeStyle = s.robe2 || s.trim; c.lineWidth = 2.2; c.beginPath(); c.moveTo(5.5, -25); c.lineTo(1, -16); c.stroke();
    if (s.armor) {
      c.fillStyle = s.armor; G.rr(c, -5, -24, 11, 11, 3); c.fill();
      c.strokeStyle = sh(s.armor, -0.4); c.lineWidth = 0.7;
      for (let y = -21; y < -13; y += 2.6) { c.beginPath(); c.moveTo(-4.5, y); c.lineTo(5.5, y); c.stroke(); }
      c.fillStyle = sh(s.armor, 0.25); ell(c, 0, -23, 5, 3.4);
    }
    c.fillStyle = s.belt || sh(s.trim, -0.25); c.fillRect(-7, -15.5, 15, 3);
    drawHead(c, s, 'side');
    // 前臂与兵器
    c.fillStyle = sh(robe, -0.08); ell(c, 2 + walk * 2, -18, 3.5, 6.4, -0.2 * walk);
    c.fillStyle = s.skin; circ(c, 3 + walk * 2.5, -12, 2.6);
    if (s.weapon) drawWeapon(c, s, 4 + walk * 2.5, -12.5, false, true);
  }

  function drawHead(c, s, view) {
    const hy = -33, hair = s.hair || '#1a1512';
    const side = view === 'side', back = view === 'up';
    const hx = side ? 1 : 0;
    // 后发
    c.fillStyle = hair; circ(c, hx - (side ? 1.5 : 0), hy - 1, 11.6);
    if (s.hat === 'hairF') { circ(c, -10, hy - 6, 4.5); circ(c, 10, hy - 6, 4.5); }
    if (back) {
      c.fillStyle = sh(hair, 0.12); ell(c, 0, hy - 4, 7, 5);
    } else {
      // 脸
      c.fillStyle = s.skin;
      if (side) ell(c, hx + 2.5, hy + 1.5, 9, 9.6); else ell(c, 0, hy + 1.5, 10, 9.8);
      // 耳
      const earR = s.ears ? 1.7 : 1;
      if (side) { ell(c, hx - 2.5, hy + 2, 2.2 * earR, 3 * earR); }
      else { ell(c, -10, hy + 2.5, 2 * earR, 3 * earR); ell(c, 10, hy + 2.5, 2 * earR, 3 * earR); }
      // 刘海
      c.fillStyle = hair; c.beginPath();
      if (side) { c.moveTo(hx - 10, hy + 2); c.quadraticCurveTo(hx - 9, hy - 12, hx + 4, hy - 11); c.quadraticCurveTo(hx + 11, hy - 8, hx + 11, hy - 3); c.quadraticCurveTo(hx + 4, hy - 6, hx - 3, hy - 4); c.lineTo(hx - 4, hy + 4); c.closePath(); }
      else { c.moveTo(-10.5, hy + 1); c.quadraticCurveTo(-11, hy - 11.5, 0, hy - 11.5); c.quadraticCurveTo(11, hy - 11.5, 10.5, hy + 1); c.quadraticCurveTo(8, hy - 5, 1, hy - 5); c.quadraticCurveTo(-7, hy - 5, -10.5, hy + 1); c.closePath(); }
      c.fill();
      // 五官
      const ex = side ? [hx + 6] : [-4.2, 4.2];
      const eyeY = hy + 1.5;
      for (const x of ex) {
        if (s.eyes === 'round') { c.fillStyle = '#fff'; circ(c, x, eyeY, 2.5); c.fillStyle = '#111'; circ(c, x + (side ? 0.8 : 0), eyeY, 1.4); }
        else { c.fillStyle = '#1c1410'; ell(c, x, eyeY, 1.4, 1.9); c.fillStyle = 'rgba(255,255,255,0.8)'; circ(c, x + 0.5, eyeY - 0.7, 0.5); }
      }
      c.strokeStyle = sh(hair, 0.05); c.lineWidth = s.brows === 'thick' ? 1.8 : 1.1; c.lineCap = 'round';
      c.beginPath();
      if (side) { c.moveTo(hx + 3.5, eyeY - 3.6); c.lineTo(hx + 8, eyeY - (s.brows === 'thick' ? 4.6 : 3.8)); }
      else {
        const lift = s.brows === 'thick' ? 1.6 : 0.4;
        c.moveTo(-6.4, eyeY - 3.4 - lift); c.lineTo(-2.4, eyeY - 3.2); c.moveTo(6.4, eyeY - 3.4 - lift); c.lineTo(2.4, eyeY - 3.2);
      }
      c.stroke(); c.lineCap = 'butt';
      if (!s.noBlush) { c.fillStyle = 'rgba(225,105,90,0.22)'; if (side) circ(c, hx + 5, hy + 5, 2.2); else { circ(c, -6, hy + 5, 2.2); circ(c, 6, hy + 5, 2.2); } }
      if (!s.beard || s.beard === 'goatee') { c.strokeStyle = sh(s.skin, -0.45); c.lineWidth = 0.9; c.beginPath(); if (side) { c.moveTo(hx + 7, hy + 7); c.lineTo(hx + 9, hy + 7); } else { c.moveTo(-1.5, hy + 7); c.lineTo(1.5, hy + 7); } c.stroke(); }
    }
    drawHat(c, s, view, hx, hy);
    if (!back && s.beard) drawBeard(c, s, side, hx, hy);
  }

  function drawHat(c, s, view, hx, hy) {
    const side = view === 'side', back = view === 'up', hc = s.hatColor || '#222';
    switch (s.hat) {
      case 'guan': // 冠
        c.fillStyle = s.hair || '#111'; circ(c, hx - (side ? 2 : 0), hy - 11, 4.5);
        c.fillStyle = hc; G.rr(c, hx - 4.5 - (side ? 2 : 0), hy - 18, 9, 7, 2); c.fill();
        c.strokeStyle = '#d6b45c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx - 8 - (side ? 2 : 0), hy - 13); c.lineTo(hx + 8 - (side ? 2 : 0), hy - 15); c.stroke();
        break;
      case 'hood': { // 巾帻
        c.fillStyle = hc; c.beginPath();
        if (side) { c.moveTo(hx - 11, hy + 1); c.quadraticCurveTo(hx - 12, hy - 14, hx + 2, hy - 13); c.quadraticCurveTo(hx + 12, hy - 11, hx + 11, hy - 4); c.lineTo(hx + 4, hy - 6); c.lineTo(hx - 5, hy - 3); c.closePath(); }
        else if (back) { c.arc(0, hy - 1, 12, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(11, hy + 3); c.lineTo(-11, hy + 3); c.closePath(); }
        else { c.moveTo(-11, hy - 1); c.quadraticCurveTo(-11.5, hy - 14, 0, hy - 14); c.quadraticCurveTo(11.5, hy - 14, 11, hy - 1); c.quadraticCurveTo(5, hy - 6, 0, hy - 5.5); c.quadraticCurveTo(-5, hy - 6, -11, hy - 1); c.closePath(); }
        c.fill();
        c.fillStyle = sh(hc, 0.2); ell(c, hx - 2, hy - 10, 4, 2);
        c.fillStyle = sh(hc, -0.2); // 巾尾
        if (side) { c.beginPath(); c.moveTo(hx - 9, hy - 6); c.quadraticCurveTo(hx - 17, hy - 2, hx - 15, hy + 7); c.lineTo(hx - 11, hy + 1); c.fill(); }
        else if (back) { c.beginPath(); c.moveTo(-3, hy - 2); c.lineTo(-6, hy + 12); c.lineTo(-1, hy + 10); c.lineTo(3, hy - 2); c.fill(); }
        break;
      }
      case 'band': // 抹额 + 乱发
        c.fillStyle = s.hair || '#111';
        for (let i = -4; i <= 4; i++) { const a = -Math.PI / 2 + i * 0.32; tri(c, hx + Math.cos(a) * 8, hy - 2 + Math.sin(a) * 8, hx + Math.cos(a - 0.2) * 10, hy - 2 + Math.sin(a - 0.2) * 10, hx + Math.cos(a) * 15, hy - 2 + Math.sin(a) * 15); }
        if (!back) {
          c.fillStyle = hc;
          if (side) { c.fillRect(hx - 10, hy - 7, 21, 3.2); c.beginPath(); c.moveTo(hx - 10, hy - 6); c.lineTo(hx - 17, hy - 2); c.lineTo(hx - 15, hy + 1); c.lineTo(hx - 9, hy - 4); c.fill(); }
          else { c.beginPath(); c.moveTo(-11, hy - 4); c.quadraticCurveTo(0, hy - 9, 11, hy - 4); c.lineTo(11, hy - 1); c.quadraticCurveTo(0, hy - 6, -11, hy - 1); c.closePath(); c.fill(); }
        } else { c.fillStyle = hc; c.fillRect(-11, hy - 5, 22, 3); c.fillRect(-2, hy - 3, 2.4, 9); c.fillRect(1, hy - 3, 2.4, 7); }
        break;
      case 'turban': { // 黄巾
        const y = '#e2b13a', yd = '#b8862a';
        c.fillStyle = y;
        if (side) { c.beginPath(); c.moveTo(hx - 11, hy - 1); c.quadraticCurveTo(hx - 11, hy - 15, hx + 2, hy - 14); c.quadraticCurveTo(hx + 12, hy - 12, hx + 11, hy - 4); c.lineTo(hx - 3, hy - 3); c.closePath(); c.fill(); }
        else { c.beginPath(); c.moveTo(-11.5, hy - 1); c.quadraticCurveTo(-12, hy - 15, 0, hy - 15); c.quadraticCurveTo(12, hy - 15, 11.5, hy - 1); c.quadraticCurveTo(0, hy - (back ? 0 : 6), -11.5, hy - 1); c.fill(); }
        c.strokeStyle = yd; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - 10, hy - 6); c.quadraticCurveTo(hx, hy - 11, hx + 10, hy - 6); c.stroke();
        c.fillStyle = y; // 结
        if (side) { circ(c, hx - 10, hy - 6, 3); c.beginPath(); c.moveTo(hx - 11, hy - 5); c.quadraticCurveTo(hx - 18, hy, hx - 16, hy + 6); c.lineTo(hx - 12, hy); c.fill(); }
        else if (back) { circ(c, 0, hy - 5, 3.2); c.fillRect(-3.5, hy - 4, 2.6, 10); c.fillRect(0.8, hy - 4, 2.6, 8); }
        else { circ(c, 0, hy - 14, 2.8); }
        break;
      }
      case 'helmet': {
        c.fillStyle = hc; c.beginPath(); c.arc(hx, hy - 3, 12, Math.PI, 0); c.lineTo(hx + 12, hy - 1); c.lineTo(hx - 12, hy - 1); c.closePath(); c.fill();
        c.fillStyle = sh(hc, 0.3); ell(c, hx - 4, hy - 9, 4, 2.5);
        c.fillStyle = sh(hc, -0.3); c.fillRect(hx - 12.5, hy - 3, 25, 2.5);
        c.fillStyle = s.plume || '#c0392b'; // 红缨
        c.beginPath(); c.moveTo(hx, hy - 15); c.quadraticCurveTo(hx - 6, hy - 22, hx - 3 - (side ? 6 : 0), hy - 25); c.quadraticCurveTo(hx + 3, hy - 21, hx + 2, hy - 15); c.fill();
        c.fillStyle = '#d6b45c'; circ(c, hx, hy - 15, 1.8);
        break;
      }
      case 'feather': { // 吕布：束发紫金冠 + 雉鸡翎
        c.fillStyle = s.hair || '#111'; circ(c, hx - (side ? 2 : 0), hy - 10, 5);
        c.fillStyle = '#d9a935'; c.beginPath(); c.moveTo(hx - 9, hy - 7); c.lineTo(hx - 6, hy - 17); c.lineTo(hx, hy - 13); c.lineTo(hx + 6, hy - 17); c.lineTo(hx + 9, hy - 7); c.quadraticCurveTo(hx, hy - 10, hx - 9, hy - 7); c.fill();
        c.fillStyle = '#c0392b'; circ(c, hx, hy - 12, 2);
        c.strokeStyle = '#7a3a1a'; c.lineWidth = 2.2; c.lineCap = 'round';
        for (const k of side ? [1] : [-1, 1]) { c.beginPath(); c.moveTo(hx + k * 4, hy - 15); c.quadraticCurveTo(hx + k * 18, hy - 40, hx + k * (side ? 30 : 8) - (side ? 26 : 0), hy - 58); c.stroke(); }
        c.strokeStyle = '#e8c070'; c.lineWidth = 0.8;
        for (const k of side ? [1] : [-1, 1]) { c.beginPath(); c.moveTo(hx + k * 4, hy - 15); c.quadraticCurveTo(hx + k * 18, hy - 40, hx + k * (side ? 30 : 8) - (side ? 26 : 0), hy - 58); c.stroke(); }
        c.lineCap = 'butt';
        break;
      }
      case 'crown': // 进贤冠（权贵）
        c.fillStyle = s.hair || '#111'; circ(c, hx - (side ? 2 : 0), hy - 11, 4.5);
        c.fillStyle = hc; c.beginPath(); c.moveTo(hx - 7, hy - 9); c.lineTo(hx - 5, hy - 21); c.lineTo(hx + 7, hy - 17); c.lineTo(hx + 7, hy - 9); c.closePath(); c.fill();
        c.fillStyle = '#d6b45c'; c.fillRect(hx - 8, hy - 10, 16, 2);
        c.strokeStyle = '#d6b45c'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - 11, hy - 14); c.lineTo(hx + 11, hy - 15); c.stroke();
        break;
      case 'scholar': // 纶巾
        c.fillStyle = hc; c.beginPath(); c.moveTo(hx - 10, hy - 4); c.quadraticCurveTo(hx - 11, hy - 15, hx, hy - 16); c.quadraticCurveTo(hx + 11, hy - 15, hx + 10, hy - 4); c.quadraticCurveTo(hx, hy - 8, hx - 10, hy - 4); c.fill();
        c.strokeStyle = sh(hc, -0.3); c.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(hx + i * 3, hy - 15); c.lineTo(hx + i * 4, hy - 6); c.stroke(); }
        c.fillStyle = sh(hc, -0.1); if (!side) { c.fillRect(hx - 2, hy - 6, 1.6, 10); c.fillRect(hx + 1, hy - 6, 1.6, 8); }
        break;
      case 'straw':
        c.fillStyle = '#c9a964'; c.beginPath(); c.moveTo(hx - 17, hy - 4); c.lineTo(hx, hy - 17); c.lineTo(hx + 17, hy - 4); c.quadraticCurveTo(hx, hy - 1, hx - 17, hy - 4); c.fill();
        c.strokeStyle = '#9c8044'; c.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(hx, hy - 17); c.lineTo(hx + i * 7, hy - 3); c.stroke(); }
        break;
      case 'bun':
        c.fillStyle = s.hair || '#222'; circ(c, hx - (side ? 3 : 0), hy - 12, 4.6);
        c.fillStyle = s.hatColor || '#9b2f2a'; c.fillRect(hx - 5 - (side ? 3 : 0), hy - 12.5, 10, 1.6);
        break;
      case 'twin':
        c.fillStyle = s.hair || '#222'; circ(c, hx - 8, hy - 10, 4.2); circ(c, hx + 8, hy - 10, 4.2);
        c.fillStyle = s.hatColor || '#c0392b'; circ(c, hx - 8, hy - 10, 1.6); circ(c, hx + 8, hy - 10, 1.6);
        break;
      case 'hairF':
        c.fillStyle = s.hair; circ(c, hx, hy - 12, 4.5);
        c.fillStyle = s.hatColor || '#d6b45c'; c.fillRect(hx - 6, hy - 13, 12, 1.4); circ(c, hx + 5, hy - 13, 1.6);
        break;
    }
  }

  function drawBeard(c, s, side, hx, hy) {
    const col = s.beardColor || s.hair || '#141010';
    c.fillStyle = col; c.strokeStyle = col;
    switch (s.beard) {
      case 'long': // 美髯
        c.beginPath();
        if (side) { c.moveTo(hx + 3, hy + 5); c.quadraticCurveTo(hx + 12, hy + 7, hx + 9, hy + 12); c.quadraticCurveTo(hx + 8, hy + 22, hx + 3, hy + 29); c.quadraticCurveTo(hx + 2, hy + 18, hx + 1, hy + 9); c.closePath(); }
        else { c.moveTo(-6.5, hy + 5); c.quadraticCurveTo(-7, hy + 17, 0, hy + 29); c.quadraticCurveTo(7, hy + 17, 6.5, hy + 5); c.quadraticCurveTo(0, hy + 9, -6.5, hy + 5); c.closePath(); }
        c.fill();
        c.lineWidth = 1.5; c.beginPath();
        if (side) { c.moveTo(hx + 6, hy + 6); c.quadraticCurveTo(hx + 10, hy + 6, hx + 11, hy + 8); }
        else { c.moveTo(-1, hy + 6); c.quadraticCurveTo(-5, hy + 5.5, -7, hy + 8); c.moveTo(1, hy + 6); c.quadraticCurveTo(5, hy + 5.5, 7, hy + 8); }
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 0.7; c.beginPath();
        if (!side) { c.moveTo(-2, hy + 10); c.quadraticCurveTo(-3, hy + 18, 0, hy + 25); } c.stroke();
        break;
      case 'bristle': // 虎须
        c.beginPath();
        if (side) { c.moveTo(hx - 2, hy); for (let i = 0; i <= 6; i++) { const a = Math.PI * 0.05 + i * 0.27; c.lineTo(hx + 3 + Math.cos(a) * (9 + (i % 2) * 4), hy + 3 + Math.sin(a) * (7 + (i % 2) * 4)); } c.lineTo(hx + 1, hy + 4); c.closePath(); }
        else { c.moveTo(-10, hy + 1); for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.05 + i * Math.PI * 0.09; c.lineTo(Math.cos(a) * (10 + (i % 2) * 4), hy + 3 + Math.sin(a) * (7 + (i % 2) * 4.5)); } c.lineTo(10, hy + 1); c.quadraticCurveTo(0, hy + 7, -10, hy + 1); c.closePath(); }
        c.fill();
        break;
      case 'thin':
        c.lineWidth = 1.1; c.beginPath();
        if (side) { c.moveTo(hx + 6, hy + 6.5); c.lineTo(hx + 10, hy + 8); c.moveTo(hx + 7, hy + 9.5); c.lineTo(hx + 8, hy + 13); }
        else { c.moveTo(-1, hy + 6.5); c.quadraticCurveTo(-4, hy + 6, -5.5, hy + 8.5); c.moveTo(1, hy + 6.5); c.quadraticCurveTo(4, hy + 6, 5.5, hy + 8.5); c.moveTo(0, hy + 9); c.lineTo(0, hy + 13); }
        c.stroke();
        break;
      case 'goatee':
        c.beginPath();
        if (side) { c.moveTo(hx + 6, hy + 9); c.lineTo(hx + 9, hy + 9); c.lineTo(hx + 6.5, hy + 16); c.closePath(); }
        else { c.moveTo(-2.5, hy + 9); c.lineTo(2.5, hy + 9); c.lineTo(0, hy + 17); c.closePath(); }
        c.fill(); break;
      case 'full':
        c.beginPath();
        if (side) { c.moveTo(hx - 1, hy + 2); c.quadraticCurveTo(hx + 12, hy + 4, hx + 9, hy + 13); c.quadraticCurveTo(hx + 4, hy + 18, hx, hy + 10); c.closePath(); }
        else { c.moveTo(-10, hy + 1); c.quadraticCurveTo(-10, hy + 16, 0, hy + 17); c.quadraticCurveTo(10, hy + 16, 10, hy + 1); c.quadraticCurveTo(0, hy + 8, -10, hy + 1); c.closePath(); }
        c.fill(); break;
    }
  }

  function drawWeapon(c, s, x, y, behind, side) {
    const w = s.weapon;
    c.save(); c.translate(x, y);
    if (side) c.rotate(0.12);
    const steel = '#d4dde0', steelD = '#8b989c';
    const pole = (top, bot, col) => { c.fillStyle = col; c.fillRect(-1.3, top, 2.6, bot - top); };
    switch (w) {
      case 'sword': case 'dsword':
        for (const off of (w === 'dsword' ? [-2.5, 2.5] : [0])) {
          c.save(); c.translate(off, 0); c.rotate(off * 0.06);
          c.fillStyle = steel; c.beginPath(); c.moveTo(-1.4, -4); c.lineTo(-1.4, -22); c.lineTo(0, -25); c.lineTo(1.4, -22); c.lineTo(1.4, -4); c.fill();
          c.fillStyle = steelD; c.fillRect(-0.3, -22, 0.6, 18);
          c.fillStyle = '#c9a24a'; c.fillRect(-3.5, -4.5, 7, 2);
          c.fillStyle = '#5a2a1a'; c.fillRect(-1, -2.5, 2, 5);
          c.restore();
        }
        break;
      case 'glaive': // 偃月刀
        pole(-46, 12, '#6b2a1c');
        c.fillStyle = '#2f7a4a'; c.beginPath(); c.moveTo(-2, -44); c.quadraticCurveTo(2, -48, 3, -44); c.lineTo(3, -40); c.lineTo(-2, -40); c.fill();
        c.fillStyle = steel; c.beginPath(); c.moveTo(-1, -44); c.quadraticCurveTo(-3, -60, 6, -68); c.quadraticCurveTo(12, -58, 9, -48); c.quadraticCurveTo(6, -44, 2, -43); c.closePath(); c.fill();
        c.fillStyle = steelD; c.beginPath(); c.moveTo(1, -45); c.quadraticCurveTo(0, -57, 6, -64); c.quadraticCurveTo(2, -55, 3, -45); c.fill();
        c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(0, -40); c.quadraticCurveTo(-6, -36, -4, -30); c.lineTo(1, -38); c.fill();
        break;
      case 'spear': case 'snake': // 蛇矛 / 长枪
        pole(-44, 12, w === 'snake' ? '#2b2420' : '#6b4a2a');
        c.fillStyle = steel;
        if (w === 'snake') { c.beginPath(); c.moveTo(-2, -44); c.lineTo(2.5, -48); c.lineTo(-1.5, -52); c.lineTo(2.5, -56); c.lineTo(0, -64); c.lineTo(-2.5, -56); c.lineTo(1, -52); c.lineTo(-3, -48); c.closePath(); c.fill(); }
        else { c.beginPath(); c.moveTo(-2.2, -44); c.lineTo(0, -56); c.lineTo(2.2, -44); c.closePath(); c.fill(); }
        c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(-1, -44); c.quadraticCurveTo(-6, -40, -3, -35); c.lineTo(2, -43); c.fill();
        break;
      case 'fan': // 羽扇
        c.fillStyle = '#6b4a2a'; c.fillRect(-0.8, -6, 1.6, 8);
        c.fillStyle = '#f3efe4'; ell(c, 0, -13, 6, 8.5);
        c.strokeStyle = '#c9c1ae'; c.lineWidth = 0.6; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, -6); c.lineTo(i * 2.6, -20); c.stroke(); }
        break;
      case 'staff':
        pole(-34, 10, '#7a5530');
        c.fillStyle = '#e2b13a'; c.fillRect(1, -34, 6, 11);
        c.strokeStyle = '#a3311f'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(2.5, -32); c.lineTo(5.5, -32); c.moveTo(4, -32); c.lineTo(4, -25); c.moveTo(2.5, -28); c.lineTo(5.5, -28); c.stroke();
        c.fillStyle = '#8a6a3a'; circ(c, 0, -35, 2.6);
        break;
      case 'sabre':
        c.fillStyle = steel; c.beginPath(); c.moveTo(-1.5, -3); c.quadraticCurveTo(-2, -16, 2, -24); c.quadraticCurveTo(3, -14, 1.5, -3); c.closePath(); c.fill();
        c.fillStyle = '#7a5530'; c.fillRect(-1.2, -3, 2.4, 6); c.fillStyle = '#c9a24a'; c.fillRect(-3, -4, 6, 1.6);
        break;
      case 'axe':
        pole(-40, 10, '#5a3a22');
        c.fillStyle = steel; c.beginPath(); c.moveTo(1, -40); c.quadraticCurveTo(14, -44, 13, -31); c.quadraticCurveTo(8, -30, 1, -32); c.closePath(); c.fill();
        c.fillStyle = steelD; c.fillRect(1, -39, 3, 8);
        break;
      case 'halberd': // 方天画戟
        pole(-50, 12, '#7a1e18');
        c.fillStyle = steel; c.beginPath(); c.moveTo(-2, -50); c.lineTo(0, -66); c.lineTo(2, -50); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(1, -49); c.quadraticCurveTo(12, -54, 11, -42); c.quadraticCurveTo(7, -46, 1, -44); c.fill();
        c.beginPath(); c.moveTo(-1, -49); c.quadraticCurveTo(-12, -54, -11, -42); c.quadraticCurveTo(-7, -46, -1, -44); c.fill();
        c.fillStyle = '#d9a935'; c.fillRect(-3, -44, 6, 2.5);
        c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(0, -41); c.quadraticCurveTo(-7, -36, -4, -30); c.lineTo(1, -39); c.fill();
        break;
      case 'bigsabre': // 大刀
        pole(-40, 12, '#4a2a1a');
        c.fillStyle = steel; c.beginPath(); c.moveTo(-1.5, -40); c.quadraticCurveTo(-4, -54, 3, -62); c.quadraticCurveTo(9, -52, 5, -40); c.closePath(); c.fill();
        c.fillStyle = '#e2b13a'; c.fillRect(-3, -41, 9, 2.5);
        break;
    }
    c.restore();
  }

  /* 头像：取人物上半身放大 */
  A.portrait = function (c, id, x, y, size, bgOverride) {
    const s = G.SPECS[id]; if (!s) return;
    c.save();
    G.rr(c, x, y, size, size, 6); c.clip();
    const base = bgOverride || s.banner || '#5a4a3a';
    const g = c.createRadialGradient(x + size * 0.5, y + size * 0.4, size * 0.1, x + size * 0.5, y + size * 0.5, size * 0.8);
    g.addColorStop(0, sh(base, 0.25)); g.addColorStop(1, sh(base, -0.55));
    c.fillStyle = g; c.fillRect(x, y, size, size);
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
    for (let i = -size; i < size; i += 7) { c.beginPath(); c.moveTo(x + i, y + size); c.lineTo(x + i + size, y); c.stroke(); }
    const scale = (size * 0.3) / 11 / (s.size || 1);
    c.translate(x + size / 2, y + size * 0.47 + 33 * scale * (s.size || 1));
    A.drawChar(c, s, 'down', 0, { scale, noShadow: true });
    c.restore();
    c.save(); G.rr(c, x, y, size, size, 6); c.lineWidth = 2; c.strokeStyle = '#d9b46a'; c.stroke(); c.restore();
  };

  /* ==========================================================
   * 树木与小物件（预渲染）
   * ========================================================== */
  function canopy(c, cx, cy, rng, n, sx, sy, rmin, rmax, cols) {
    const blobs = [];
    for (let i = 0; i < n; i++) { const a = rng() * TAU, d = Math.sqrt(rng()); blobs.push([cx + Math.cos(a) * d * sx, cy + Math.sin(a) * d * sy, rmin + rng() * (rmax - rmin)]); }
    blobs.sort((a, b) => a[1] - b[1]);
    c.fillStyle = cols[0]; for (const b of blobs) circ(c, b[0] + 1, b[1] + 2.5, b[2] + 2);
    c.fillStyle = cols[1]; for (const b of blobs) circ(c, b[0], b[1], b[2]);
    c.fillStyle = cols[2]; for (const b of blobs) circ(c, b[0] - b[2] * 0.22, b[1] - b[2] * 0.28, b[2] * 0.66);
    c.fillStyle = cols[3]; for (const b of blobs) if (b[1] < cy + sy * 0.3) circ(c, b[0] - b[2] * 0.36, b[1] - b[2] * 0.45, b[2] * 0.32);
    return blobs;
  }
  A.TREE_ANCHOR = { x: 52, y: 130 };
  A.tree = function (kind, v) {
    return mk('tree_' + kind + '_' + v, 104, 136, c => {
      const rng = G.seeded(v * 977 + kind.length * 131 + 5);
      const cx = 52, base = 130;
      if (kind === 'pine') {
        c.fillStyle = '#3b2a1e'; c.fillRect(cx - 4, base - 28, 8, 28);
        const cols = ['#11231a', '#1f4029', '#2f5e3a', '#4a7f4c'];
        for (let i = 0; i < 4; i++) {
          const y = base - 20 - i * 21, w = 40 - i * 8 + rng() * 4, h = 36;
          c.fillStyle = cols[0]; tri(c, cx, y - h - 2, cx - w - 3, y + 3, cx + w + 3, y + 3);
          c.fillStyle = cols[1]; tri(c, cx, y - h, cx - w, y, cx + w, y);
          c.fillStyle = cols[2]; tri(c, cx, y - h, cx - w * 0.92, y - 1, cx + w * 0.05, y - 3);
          c.fillStyle = cols[3]; tri(c, cx - 2, y - h + 6, cx - w * 0.6, y - 4, cx - w * 0.2, y - 6);
          c.fillStyle = cols[0];
          for (let k = -w + 6; k < w - 4; k += 8) tri(c, cx + k, y - 1, cx + k + 4, y + 4, cx + k + 8, y - 1);
        }
      } else if (kind === 'bamboo') {
        for (let i = 0; i < 9; i++) {
          const x = cx - 26 + rng() * 52, top = base - 70 - rng() * 50, lean = (rng() - 0.5) * 14;
          c.strokeStyle = rng() < 0.5 ? '#4f8a3a' : '#3a7030'; c.lineWidth = 3.2;
          c.beginPath(); c.moveTo(x, base - 2); c.quadraticCurveTo(x + lean * 0.3, (base + top) / 2, x + lean, top); c.stroke();
          c.strokeStyle = 'rgba(20,50,20,0.6)'; c.lineWidth = 3.6;
          for (let y = base - 14; y > top + 6; y -= 13) { const t = (base - y) / (base - top); c.beginPath(); c.moveTo(x + lean * t * t - 2, y); c.lineTo(x + lean * t * t + 2, y); c.stroke(); }
          for (let k = 0; k < 7; k++) {
            const t = 0.45 + rng() * 0.55, lx = x + lean * t * t, ly = base - (base - top) * t, a = (rng() - 0.5) * 2.4 + (rng() < 0.5 ? 0 : Math.PI);
            c.fillStyle = ['#5da046', '#7cbf5a', '#3f7a34'][k % 3];
            c.save(); c.translate(lx, ly); c.rotate(a); c.beginPath(); c.ellipse(9, 0, 10, 2.6, 0, 0, TAU); c.fill(); c.restore();
          }
        }
      } else if (kind === 'bush') {
        const cols = ['#1a2c17', '#2f5226', '#4a7a35', '#77a54b'];
        const bl = canopy(c, cx, base - 14, rng, 7, 18, 7, 8, 12, cols);
        if (v % 2) for (let i = 0; i < 12; i++) { const b = bl[i % bl.length]; c.fillStyle = ['#f0e6f0', '#f2c94c', '#e88aa8'][i % 3]; circ(c, b[0] + (rng() - 0.5) * b[2], b[1] + (rng() - 0.5) * b[2], 1.5); }
      } else if (kind === 'rock') {
        c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, cx + 2, base - 3, 18, 6);
        c.fillStyle = '#5d5f5a'; c.beginPath(); c.moveTo(cx - 17, base - 4); c.lineTo(cx - 14, base - 18); c.lineTo(cx - 3, base - 26); c.lineTo(cx + 10, base - 22); c.lineTo(cx + 17, base - 9); c.lineTo(cx + 14, base - 2); c.closePath(); c.fill();
        c.fillStyle = '#878a82'; c.beginPath(); c.moveTo(cx - 14, base - 18); c.lineTo(cx - 3, base - 26); c.lineTo(cx + 10, base - 22); c.lineTo(cx + 2, base - 15); c.lineTo(cx - 10, base - 12); c.closePath(); c.fill();
        c.fillStyle = '#a5a89e'; c.beginPath(); c.moveTo(cx - 9, base - 19); c.lineTo(cx - 3, base - 24); c.lineTo(cx + 3, base - 21); c.lineTo(cx - 4, base - 17); c.closePath(); c.fill();
        c.fillStyle = 'rgba(80,120,50,0.6)'; ell(c, cx - 12, base - 5, 5, 2.5); ell(c, cx + 11, base - 4, 4, 2);
      } else if (kind === 'stake') {
        for (let i = 0; i < 3; i++) {
          const x = cx - 18 + i * 12, top = base - 62 + rng() * 8;
          const g = c.createLinearGradient(x, 0, x + 11, 0); g.addColorStop(0, '#8a6038'); g.addColorStop(1, '#4e3320');
          c.fillStyle = g; c.beginPath(); c.moveTo(x, base); c.lineTo(x, top + 8); c.lineTo(x + 5.5, top); c.lineTo(x + 11, top + 8); c.lineTo(x + 11, base); c.closePath(); c.fill();
          c.fillStyle = '#c9a678'; tri(c, x + 1, top + 8, x + 5.5, top, x + 6, top + 8);
          c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 4, top + 14); c.lineTo(x + 4, base - 6); c.stroke();
        }
        c.fillStyle = '#6b5434'; c.fillRect(cx - 24, base - 40, 48, 3); c.fillRect(cx - 24, base - 18, 48, 3);
      } else {
        // 阔叶树 / 桃树 / 柳
        c.fillStyle = 'rgba(0,0,0,0)';
        const tg = c.createLinearGradient(cx - 7, 0, cx + 7, 0); tg.addColorStop(0, '#6a4a32'); tg.addColorStop(1, '#3a2618');
        c.fillStyle = tg; c.beginPath(); c.moveTo(cx - 7, base); c.quadraticCurveTo(cx - 3, base - 22, cx - 4, base - 46); c.lineTo(cx + 4, base - 46); c.quadraticCurveTo(cx + 3, base - 22, cx + 8, base); c.closePath(); c.fill();
        c.strokeStyle = '#4a3222'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(cx - 2, base - 36); c.lineTo(cx - 16, base - 54); c.moveTo(cx + 2, base - 40); c.lineTo(cx + 15, base - 58); c.stroke(); c.lineCap = 'butt';
        const peach = kind === 'peach';
        const cols = kind === 'autumn' ? ['#4a2410', '#94501a', '#c47e2a', '#e8b04a'] : kind === 'gold' ? ['#4a3a10', '#8a7a1a', '#b8a02a', '#e0cc5a'] : kind === 'snowy' ? ['#3a4a48', '#7a8c8a', '#c8d4d6', '#ffffff'] : peach ? ['#2a3a1f', '#4b6a30', '#6a8f40', '#8fb258'] : (kind === 'dark' ? ['#121f15', '#1f3a24', '#2e5532', '#477a43'] : ['#1b2d19', '#30562a', '#4b7c36', '#79a64d']);
        const bl = canopy(c, cx, base - 72, rng, 14, 30, 22, 13, 20, cols);
        if (peach) {
          const pinks = ['#f9cfdc', '#f3a6c0', '#fde9f0', '#e7849f', '#f7b8cb'];
          for (let i = 0; i < 95; i++) {
            const b = bl[Math.floor(rng() * bl.length)], a = rng() * TAU, d = rng() * b[2] * 0.95;
            const x = b[0] + Math.cos(a) * d, y = b[1] + Math.sin(a) * d - 2;
            c.fillStyle = pinks[Math.floor(rng() * pinks.length)]; circ(c, x, y, 1.4 + rng() * 2.4);
          }
          c.fillStyle = 'rgba(255,240,245,0.55)'; for (let i = 0; i < 18; i++) { const b = bl[i % bl.length]; circ(c, b[0] - b[2] * 0.4, b[1] - b[2] * 0.5, 1.6); }
        }
      }
    });
  };

  /* ==========================================================
   * 地表预渲染（整张地图一次画好）
   * ========================================================== */
  A.renderGround = function (m) {
    const TL = G.TL, R = G.dpr > 1 ? 1.5 : 1, W = m.w * T, H = m.h * T;
    const cv = G.makeCanvas(W * R, H * R), c = cv.getContext('2d');
    c.scale(R, R); cv.R = R;
    const seed = m.seed || 1, rng = G.seeded(seed * 7919 + 3);
    const soilMap = m.under === TL.SOIL;
    const get = (x, y) => m.get(G.clamp(x, 0, m.w - 1), G.clamp(y, 0, m.h - 1));
    const grassy = t => t === TL.GRASS || t === TL.TALL;

    const P = Object.assign({ gh: 80, gs: 34, gl: 26, sh: 28, ss: 20, sl: 20, path1: '#9c8459', path2: '#ad9568', soilPath1: '#7d6648', soilPath2: '#8b7352' }, m.pal || {});
    c.fillStyle = soilMap ? `hsl(${P.sh + 5},${P.ss + 6}%,${P.sl + 5}%)` : `hsl(${P.gh + 12},${P.gs + 6}%,${P.gl + 6}%)`; c.fillRect(0, 0, W, H);
    // 1. 大面积柔和色块
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const t = m.get(x, y), n = G.fbm(x / 5, y / 5, seed);
      const soil = t === TL.SOIL || (soilMap && !grassy(t));
      const h = soil ? P.sh + n * 10 : P.gh + n * 28, s = soil ? P.ss + n * 12 : P.gs + n * 14, l = soil ? P.sl + n * 11 : P.gl + n * 13;
      const px = x * T + T / 2, py = y * T + T / 2;
      const g = c.createRadialGradient(px, py, 0, px, py, T * 0.95);
      g.addColorStop(0, `hsla(${h},${s}%,${l}%,0.9)`); g.addColorStop(1, `hsla(${h},${s}%,${l}%,0)`);
      c.fillStyle = g; c.fillRect(px - T, py - T, 2 * T, 2 * T);
    }
    // 2. 光斑
    for (let i = 0; i < (m.w * m.h) / 5; i++) {
      const px = rng() * W, py = rng() * H, r = 30 + rng() * 70, light = rng() < 0.5;
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, light ? 'rgba(255,245,190,0.06)' : 'rgba(0,25,10,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(px - r, py - r, 2 * r, 2 * r);
    }
    // 3. 草叶
    c.lineCap = 'round';
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const t = m.get(x, y);
      if (t === TL.TALL) {
        for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(15,35,12,0.35)'; ell(c, x * T + rng() * T, y * T + rng() * T, 9, 5); }
        for (let k = 0; k < 26; k++) {
          const bx = x * T + rng() * T, by = y * T + 6 + rng() * (T - 6), len = 8 + rng() * 10, lean = (rng() - 0.5) * 7;
          c.strokeStyle = rng() < 0.55 ? `hsla(${P.gh + 8},40%,${P.gl + 26}%,0.75)` : `hsla(${P.gh + 15},45%,${Math.max(8, P.gl - 12)}%,0.7)`; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + lean * 0.3, by - len * 0.6, bx + lean, by - len); c.stroke();
        }
      } else if (t === TL.GRASS || (t === TL.SOIL && rng() < 0.3)) {
        const n = t === TL.SOIL ? 3 : 9;
        for (let k = 0; k < n; k++) {
          const bx = x * T + rng() * T, by = y * T + rng() * T, len = 3 + rng() * 5, lean = (rng() - 0.5) * 4;
          c.strokeStyle = rng() < 0.5 ? `hsla(${P.gh + 5},45%,${P.gl + 32}%,0.45)` : `hsla(${P.gh + 15},45%,${Math.max(6, P.gl - 15)}%,0.4)`; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + lean * 0.3, by - len * 0.6, bx + lean, by - len); c.stroke();
        }
      } else if (t === TL.SOIL) {
        for (let k = 0; k < 3; k++) { c.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,230,190,0.08)'; circ(c, x * T + rng() * T, y * T + rng() * T, 1 + rng() * 2); }
      }
    }
    c.lineCap = 'butt';
    // 通用：按邻接画连贯斑块
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    function blobs(test, r, fill, jitter = 2) {
      c.fillStyle = fill;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!test(m.get(x, y))) continue;
        const cx = x * T + T / 2 + (G.hash(x, y, 5) - 0.5) * jitter, cy = y * T + T / 2 + (G.hash(x, y, 9) - 0.5) * jitter;
        circ(c, cx, cy, r);
        for (const [dx, dy] of DIRS) if (test(get(x + dx, y + dy)) && m.inb(x + dx, y + dy)) circ(c, x * T + T / 2 + dx * T / 2, y * T + T / 2 + dy * T / 2, r);
        // 地图边缘延伸
        for (const [dx, dy] of DIRS) if (!m.inb(x + dx, y + dy)) circ(c, x * T + T / 2 + dx * T * 0.6, y * T + T / 2 + dy * T * 0.6, r);
      }
    }
    // 4. 道路
    const isPath = t => t === TL.PATH || t === TL.BRIDGE;
    blobs(isPath, T * 0.72, soilMap ? 'rgba(30,20,10,0.25)' : 'rgba(45,35,15,0.3)', 4);
    blobs(t => t === TL.PATH, T * 0.6, soilMap ? P.soilPath1 : P.path1, 3);
    blobs(t => t === TL.PATH, T * 0.42, soilMap ? P.soilPath2 : P.path2, 3);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.PATH) {
      for (let k = 0; k < 5; k++) { c.fillStyle = rng() < 0.5 ? 'rgba(70,55,35,0.45)' : 'rgba(225,210,170,0.35)'; ell(c, x * T + 6 + rng() * (T - 12), y * T + 6 + rng() * (T - 12), 1.5 + rng() * 2, 1 + rng() * 1.4); }
    }
    // 5. 石板地
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.FLOOR) {
      c.fillStyle = '#7b7568'; c.fillRect(x * T, y * T, T, T);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const v = G.hash(x * 2 + i, y * 2 + j, 3);
        c.fillStyle = `hsl(40,${8 + v * 6}%,${52 + v * 10}%)`;
        G.rr(c, x * T + i * 24 + 1, y * T + j * 24 + 1, 22, 22, 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x * T + i * 24 + 2, y * T + j * 24 + 2, 20, 2);
      }
    }
    // 6. 水体（沙岸 → 浅水 → 深水）
    const isW = t => t === TL.WATER || t === TL.BRIDGE;
    blobs(isW, T * 0.78, '#b8a677', 3);
    blobs(isW, T * 0.66, '#9e9066', 3);
    blobs(isW, T * 0.58, '#3f7487', 2);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!isW(m.get(x, y))) continue;
      let deep = true; for (const [dx, dy] of DIRS) if (!isW(get(x + dx, y + dy))) deep = false;
      if (deep) { const g = c.createRadialGradient(x * T + T / 2, y * T + T / 2, 0, x * T + T / 2, y * T + T / 2, T * 0.9); g.addColorStop(0, 'rgba(20,50,70,0.55)'); g.addColorStop(1, 'rgba(20,50,70,0)'); c.fillStyle = g; c.fillRect(x * T - T / 2, y * T - T / 2, T * 2, T * 2); }
    }
    // 7. 桥
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.BRIDGE) {
      const horiz = isPath(get(x - 1, y)) || isPath(get(x + 1, y)) || !isW(get(x - 1, y)) || !isW(get(x + 1, y));
      const X = x * T, Y = y * T;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      if (horiz) c.fillRect(X - 2, Y + 8, T + 4, T - 8); else c.fillRect(X + 8, Y - 2, T - 8, T + 4);
      c.fillStyle = '#8a6236';
      if (horiz) c.fillRect(X - 2, Y + 4, T + 4, T - 10); else c.fillRect(X + 4, Y - 2, T - 10, T + 4);
      c.strokeStyle = '#5a3d20'; c.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) { c.beginPath(); if (horiz) { c.moveTo(X + k * 8, Y + 4); c.lineTo(X + k * 8, Y + T - 6); } else { c.moveTo(X + 4, Y + k * 8); c.lineTo(X + T - 6, Y + k * 8); } c.stroke(); }
      c.fillStyle = '#5a3d20';
      const up = get(x, y - 1) === TL.BRIDGE, dn = get(x, y + 1) === TL.BRIDGE, lf = get(x - 1, y) === TL.BRIDGE, rt = get(x + 1, y) === TL.BRIDGE;
      if (horiz) { if (!up) c.fillRect(X - 2, Y + 2, T + 4, 4); if (!dn) c.fillRect(X - 2, Y + T - 8, T + 4, 4); }
      else { if (!lf) c.fillRect(X + 2, Y - 2, 4, T + 4); if (!rt) c.fillRect(X + T - 8, Y - 2, 4, T + 4); }
    }
    // 8. 城墙
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WALL) {
      const X = x * T, Y = y * T, below = get(x, y + 1) === TL.WALL && m.inb(x, y + 1);
      if (below) {
        c.fillStyle = '#8e8a7f'; c.fillRect(X, Y, T, T);
        c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1;
        for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(X, Y + k * 16 + 0.5); c.lineTo(X + T, Y + k * 16 + 0.5); c.stroke(); }
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(X, Y, T, 3);
        if (get(x, y - 1) !== TL.WALL || y === 0) { c.fillStyle = '#6d695f'; for (let k = 0; k < 4; k++) c.fillRect(X + k * 12 + 1, Y, 9, 7); }
      } else {
        c.fillStyle = '#6e695f'; c.fillRect(X, Y, T, T);
        c.fillStyle = '#9a958a'; c.fillRect(X, Y, T, 8);
        for (let k = 0; k < 4; k++) c.fillRect(X + k * 12 + 1, Y - 6, 9, 7);
        c.strokeStyle = 'rgba(30,25,20,0.45)'; c.lineWidth = 1;
        for (let r = 0; r < 5; r++) {
          const yy = Y + 10 + r * 8; c.beginPath(); c.moveTo(X, yy); c.lineTo(X + T, yy); c.stroke();
          for (let k = 0; k < 4; k++) { const xx = X + k * 14 + (r % 2) * 7; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 8); c.stroke(); }
        }
        const g = c.createLinearGradient(0, Y + T, 0, Y + T + 14); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(X, Y + T, T, 14);
      }
    }
    // 9. 花草碎石
    const flowerCols = ['#f4f1e6', '#f2cf55', '#ef9ab6', '#b99ae8', '#f08a5d'];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const t = m.get(x, y);
      if (t === TL.GRASS && G.hash(x, y, seed) < (m.flowers ?? 0.06) && !m.blockedAt(x, y)) {
        const col = flowerCols[Math.floor(G.hash(x, y, 2) * flowerCols.length)];
        for (let k = 0; k < 5; k++) {
          const fx = x * T + 8 + rng() * (T - 16), fy = y * T + 8 + rng() * (T - 16);
          c.strokeStyle = 'rgba(40,80,30,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fy + 4); c.lineTo(fx, fy); c.stroke();
          c.fillStyle = col; for (let p = 0; p < 5; p++) circ(c, fx + Math.cos(p * 1.256) * 2, fy + Math.sin(p * 1.256) * 2, 1.4);
          c.fillStyle = '#f7d65a'; circ(c, fx, fy, 0.9);
        }
      }
    }
    // 10. 树与道具的投影
    for (const o of m.objs) {
      const r = o.kind === 'bush' ? 18 : o.kind === 'rock' || o.kind === 'stake' ? 0 : 26;
      if (!r) continue;
      const g = c.createRadialGradient(o.x * T + T / 2 + 4, o.y * T + T - 6, 0, o.x * T + T / 2 + 4, o.y * T + T - 6, r);
      g.addColorStop(0, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; ell(c, o.x * T + T / 2 + 4, o.y * T + T - 6, r, r * 0.42);
    }
    return cv;
  };

  /* ==========================================================
   * 建筑与道具
   * ========================================================== */
  function roofShape(c, W, ov, eaveY, ridgeY) {
    c.beginPath(); c.moveTo(-ov, eaveY - 10);
    c.quadraticCurveTo(W * 0.1, eaveY + 4, W * 0.22, eaveY + 2); c.lineTo(W * 0.78, eaveY + 2);
    c.quadraticCurveTo(W * 0.9, eaveY + 4, W + ov, eaveY - 10);
    c.lineTo(W * 0.86, ridgeY + 10); c.lineTo(W * 0.14, ridgeY + 10); c.closePath();
  }
  function drawRoof(c, W, eaveY, ridgeY, col, ov = 16) {
    roofShape(c, W, ov, eaveY, ridgeY);
    const g = c.createLinearGradient(0, ridgeY, 0, eaveY); g.addColorStop(0, sh(col, -0.3)); g.addColorStop(1, sh(col, 0.15));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.strokeStyle = sh(col, -0.45); c.lineWidth = 1.6;
    const n = Math.round(W / 6.5);
    for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(W * 0.14 + W * 0.72 * i / n, ridgeY + 10); c.lineTo(-ov + (W + 2 * ov) * i / n, eaveY + 6); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
    for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(W * 0.14 + W * 0.72 * i / n + 2.5, ridgeY + 10); c.lineTo(-ov + (W + 2 * ov) * i / n + 3, eaveY + 6); c.stroke(); }
    c.restore();
    c.strokeStyle = sh(col, -0.55); c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-ov, eaveY - 10); c.quadraticCurveTo(W * 0.1, eaveY + 4, W * 0.22, eaveY + 2); c.lineTo(W * 0.78, eaveY + 2); c.quadraticCurveTo(W * 0.9, eaveY + 4, W + ov, eaveY - 10); c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = sh(col, 0.25); for (let x = W * 0.22; x <= W * 0.78; x += 7) circ(c, x, eaveY + 3, 1.6);
    c.fillStyle = sh(col, -0.5); G.rr(c, W * 0.12, ridgeY + 2, W * 0.76, 10, 3); c.fill();
    c.fillStyle = sh(col, -0.2); c.fillRect(W * 0.12, ridgeY + 3, W * 0.76, 2);
    for (const s of [-1, 1]) {
      const x = s < 0 ? W * 0.12 : W * 0.88;
      c.fillStyle = sh(col, -0.55); c.beginPath(); c.moveTo(x, ridgeY + 11); c.quadraticCurveTo(x - s * 6, ridgeY - 2, x - s * 1, ridgeY - 8); c.quadraticCurveTo(x + s * 4, ridgeY - 2, x + s * 4, ridgeY + 6); c.closePath(); c.fill();
    }
  }
  function lattice(c, x, y, w, h) {
    c.fillStyle = '#3b2a1e'; c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = '#1e140d'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,200,120,0.18)'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#a8834f'; c.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + (w * i) / 4, y); c.lineTo(x + (w * i) / 4, y + h); c.stroke(); }
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x, y + (h * i) / 3); c.lineTo(x + w, y + (h * i) / 3); c.stroke(); }
  }
  function houseImg(p) {
    const W = p.w * T, H = p.h * T, M = 20;
    return mk(`house_${p.w}_${p.h}_${p.sign || ''}_${p.roof || ''}_${p.wall || ''}`, W + M * 2, H + 10, c => {
      c.translate(M, 6);
      const roofCol = p.roof || '#3d4654';
      const eaveY = Math.round(H * 0.5), ridgeY = 0, base = H - 8, wallTop = eaveY - 4;
      c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, W / 2 + 8, base + 1, W / 2 + 10, 10);
      c.fillStyle = '#857c6d'; c.fillRect(2, base - 10, W - 4, 13); c.fillStyle = '#a39a89'; c.fillRect(2, base - 10, W - 4, 3);
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1; for (let x = 10; x < W - 4; x += 16) { c.beginPath(); c.moveTo(x, base - 7); c.lineTo(x, base + 3); c.stroke(); }
      let g = c.createLinearGradient(0, wallTop, 0, base); g.addColorStop(0, p.wall || '#d8cbb0'); g.addColorStop(1, sh(p.wall || '#d8cbb0', 0.12));
      c.fillStyle = g; c.fillRect(8, wallTop, W - 16, base - 10 - wallTop);
      g = c.createLinearGradient(0, wallTop, 0, wallTop + 20); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(8, wallTop, W - 16, 20);
      const cols = Math.max(2, Math.round(p.w / 2) + 1);
      for (let i = 0; i < cols; i++) { const x = 8 + (i * (W - 22)) / (cols - 1); c.fillStyle = '#7b2f22'; c.fillRect(x, wallTop, 6, base - 10 - wallTop); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x, wallTop, 1.5, base - 10 - wallTop); }
      c.fillStyle = '#5e2a1e'; c.fillRect(8, wallTop + 8, W - 16, 4);
      const dw = 26, dh = Math.min(36, base - 10 - wallTop - 14), dx = W / 2 - dw / 2, dy = base - 10 - dh;
      c.fillStyle = '#3a1d14'; c.fillRect(dx - 3, dy - 3, dw + 6, dh + 3);
      c.fillStyle = '#8a2f20'; c.fillRect(dx, dy, dw, dh);
      c.fillStyle = '#5a1e15'; c.fillRect(W / 2 - 0.75, dy, 1.5, dh);
      c.fillStyle = '#d6b45c'; for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) circ(c, W / 2 + sx * 6.5, dy + 7 + r * 9, 1.1);
      if (p.w >= 5) { const wy = wallTop + 18, wh = Math.min(18, dy - wy - 4); if (wh > 8) { lattice(c, W * 0.18 - 11, wy, 22, wh); lattice(c, W * 0.82 - 11, wy, 22, wh); } }
      if (p.lantern !== false) for (const sx of [-1, 1]) {
        const lx = W / 2 + sx * (dw / 2 + 12), ly = wallTop + 10;
        c.strokeStyle = '#3a2a1e'; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, wallTop + 2); c.lineTo(lx, ly); c.stroke();
        c.fillStyle = '#c23b2a'; ell(c, lx, ly + 6, 5, 6.5); c.fillStyle = '#e8b04a'; c.fillRect(lx - 3, ly - 1, 6, 1.8); c.fillRect(lx - 3, ly + 11, 6, 1.8);
      }
      drawRoof(c, W, eaveY, ridgeY, roofCol);
      if (p.sign) {
        c.font = G.font(17, true);
        const sw = c.measureText(p.sign).width + 18, sx = W / 2 - sw / 2, sy = eaveY + 7;
        c.fillStyle = '#1a120d'; G.rr(c, sx - 2, sy - 2, sw + 4, 27, 3); c.fill();
        c.fillStyle = '#3a2418'; G.rr(c, sx, sy, sw, 23, 2); c.fill();
        c.strokeStyle = '#c9a24a'; c.lineWidth = 1; G.rr(c, sx + 2, sy + 2, sw - 4, 19, 2); c.stroke();
        c.fillStyle = '#ecd08a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.sign, W / 2, sy + 12.5);
      }
    });
  }

  function pavilionImg(p) {
    const W = p.w * T, H = p.h * T, M = 20;
    return mk('pavilion_' + p.w + p.h + (p.plaque || ''), W + 2 * M, H + 40, c => {
      c.translate(M, 34);
      const base = H - 6;
      c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, W / 2 + 6, base, W / 2 + 6, 12);
      // 台基
      c.fillStyle = '#8d8576'; G.rr(c, 26, H * 0.42, W - 52, base - H * 0.42, 4); c.fill();
      c.fillStyle = '#b1a894'; G.rr(c, 30, H * 0.42 + 2, W - 60, base - H * 0.42 - 16, 3); c.fill();
      c.fillStyle = '#6f685b'; c.fillRect(26, base - 12, W - 52, 12);
      c.fillStyle = '#9d9483'; for (let x = 34; x < W - 40; x += 18) c.fillRect(x, base - 10, 14, 4);
      // 后柱
      c.fillStyle = '#6b231a'; c.fillRect(46, H * 0.22, 6, H * 0.3); c.fillRect(W - 52, H * 0.22, 6, H * 0.3);
      // 香案
      const tx = W / 2, ty = H * 0.62;
      c.fillStyle = '#5a1a12'; c.fillRect(tx - 34, ty - 4, 68, 22);
      c.fillStyle = '#8e2a1c'; c.fillRect(tx - 38, ty - 10, 76, 8);
      c.fillStyle = '#d6b45c'; c.fillRect(tx - 38, ty - 3, 76, 1.5);
      c.fillStyle = '#c9a24a'; c.fillRect(tx - 30, ty + 2, 4, 16); c.fillRect(tx + 26, ty + 2, 4, 16);
      // 香炉（鼎）
      c.fillStyle = '#7d6a3a'; ell(c, tx, ty - 14, 10, 7);
      c.fillStyle = '#a58a46'; ell(c, tx, ty - 18, 10, 3);
      c.fillStyle = '#5d4e2a'; c.fillRect(tx - 7, ty - 12, 2, 5); c.fillRect(tx + 5, ty - 12, 2, 5);
      c.strokeStyle = '#7d6a3a'; c.lineWidth = 1.5; c.beginPath(); c.arc(tx - 11, ty - 18, 3, Math.PI * 0.5, Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(tx + 11, ty - 18, 3, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
      c.strokeStyle = '#d9c9a0'; c.lineWidth = 1; for (const o of [-3, 0, 3]) { c.beginPath(); c.moveTo(tx + o, ty - 18); c.lineTo(tx + o, ty - 28); c.stroke(); }
      c.fillStyle = '#e8582f'; for (const o of [-3, 0, 3]) circ(c, tx + o, ty - 28, 0.9);
      // 蜡烛、桃子
      for (const sx of [-1, 1]) { c.fillStyle = '#c0392b'; c.fillRect(tx + sx * 24 - 2, ty - 22, 4, 12); c.fillStyle = '#f7d36a'; ell(c, tx + sx * 24, ty - 25, 2, 3.5); }
      c.fillStyle = '#d9cdb5'; ell(c, tx + 14, ty - 11, 6, 2); ell(c, tx - 14, ty - 11, 6, 2);
      for (const [px, py] of [[-16, -14], [-12, -15], [-14, -17]]) { c.fillStyle = '#f19a9a'; circ(c, tx + px, ty + py, 2.8); c.fillStyle = '#e66a6a'; circ(c, tx + px + 1, ty + py + 0.5, 1.6); }
      for (const [px, py] of [[12, -14], [16, -14], [14, -17]]) { c.fillStyle = '#e0c06a'; circ(c, tx + px, ty + py, 2.6); }
      // 前柱
      for (const x of [30, W - 36]) {
        const g = c.createLinearGradient(x, 0, x + 7, 0); g.addColorStop(0, '#b2402e'); g.addColorStop(1, '#6b231a');
        c.fillStyle = g; c.fillRect(x, H * 0.18, 7, base - 12 - H * 0.18);
        c.fillStyle = '#4d4a44'; c.fillRect(x - 2, base - 16, 11, 5);
      }
      // 攒尖顶
      const ey = H * 0.24, ov = 22;
      c.beginPath(); c.moveTo(-ov + 10, ey - 14); c.quadraticCurveTo(W * 0.15, ey + 6, W * 0.3, ey + 4); c.lineTo(W * 0.7, ey + 4);
      c.quadraticCurveTo(W * 0.85, ey + 6, W + ov - 10, ey - 14); c.quadraticCurveTo(W * 0.62, ey - 22, W / 2, -24); c.quadraticCurveTo(W * 0.38, ey - 22, -ov + 10, ey - 14); c.closePath();
      const g = c.createLinearGradient(0, -24, 0, ey); g.addColorStop(0, '#2d3540'); g.addColorStop(1, '#4b5664'); c.fillStyle = g; c.fill();
      c.save(); c.clip(); c.strokeStyle = 'rgba(15,20,25,0.6)'; c.lineWidth = 1.4;
      for (let i = 0; i <= 22; i++) { c.beginPath(); c.moveTo(W / 2, -24); c.lineTo(-ov + (W + 2 * ov) * i / 22, ey + 8); c.stroke(); }
      c.restore();
      c.strokeStyle = '#1e242c'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-ov + 10, ey - 14); c.quadraticCurveTo(W * 0.15, ey + 6, W * 0.3, ey + 4); c.lineTo(W * 0.7, ey + 4); c.quadraticCurveTo(W * 0.85, ey + 6, W + ov - 10, ey - 14); c.stroke(); c.lineCap = 'butt';
      c.fillStyle = '#c9a24a'; circ(c, W / 2, -27, 5); c.fillRect(W / 2 - 2, -40, 4, 12); circ(c, W / 2, -40, 3);
      // 匾
      c.fillStyle = '#1a120d'; G.rr(c, W / 2 - 30, ey + 6, 60, 22, 2); c.fill();
      c.strokeStyle = '#c9a24a'; c.lineWidth = 1; G.rr(c, W / 2 - 28, ey + 8, 56, 18, 2); c.stroke();
      c.fillStyle = '#ecd08a'; c.font = G.font(15, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.plaque || '义 结 金 兰', W / 2, ey + 17.5);
    });
  }

  function gateImg(p) {
    const W = p.w * T, H = p.h * T;
    return mk('gate_' + p.w + (p.plaque || ''), W + 30, H + 96, c => {
      c.translate(15, 90);
      // 两侧墩台
      for (const x of [0, W - T]) {
        c.fillStyle = '#625d54'; c.fillRect(x - 4, -8, T + 8, H + 8);
        c.strokeStyle = 'rgba(20,18,14,0.5)'; c.lineWidth = 1;
        for (let r = 0; r < 12; r++) { const y = -4 + r * 8; c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + T + 4, y); c.stroke(); for (let k = 0; k < 4; k++) { const xx = x - 4 + k * 14 + (r % 2) * 7; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + 8); c.stroke(); } }
        c.fillStyle = '#8e897d'; c.fillRect(x - 4, -12, T + 8, 6);
      }
      // 门楣
      c.fillStyle = '#4a453d'; c.fillRect(T - 4, -10, W - 2 * T + 8, 16);
      c.fillStyle = '#2a2621'; c.beginPath(); c.moveTo(T, 6); c.quadraticCurveTo(W / 2, -4, W - T, 6); c.lineTo(W - T, 10); c.quadraticCurveTo(W / 2, 2, T, 10); c.fill();
      // 城楼
      const bw = W - 20, bx = 10, top = -70;
      c.fillStyle = '#d8cbb0'; c.fillRect(bx + 6, top + 22, bw - 12, 36);
      for (let i = 0; i < 6; i++) { const x = bx + 6 + i * (bw - 18) / 5; c.fillStyle = '#7b2f22'; c.fillRect(x, top + 22, 6, 36); }
      lattice(c, bx + 26, top + 30, 22, 18); lattice(c, bx + bw - 48, top + 30, 22, 18);
      c.fillStyle = '#5b2117'; c.fillRect(bx, top + 56, bw, 6);
      c.fillStyle = '#7f7a6f'; c.fillRect(bx - 6, top + 60, bw + 12, 10);
      c.save(); c.translate(bx, top - 12); drawRoof(c, bw, 36, 0, '#38414e', 22); c.restore();
      if (p.plaque) {
        c.fillStyle = '#1a120d'; G.rr(c, W / 2 - 32, top + 28, 64, 24, 2); c.fill();
        c.strokeStyle = '#c9a24a'; G.rr(c, W / 2 - 30, top + 30, 60, 20, 2); c.stroke();
        c.fillStyle = '#ecd08a'; c.font = G.font(16, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.plaque, W / 2, top + 40.5);
      }
    });
  }

  function tentImg(p, big) {
    const W = p.w * T, H = p.h * T;
    return mk('tent_' + p.w + '_' + p.h + (big ? 'b' : '') + (p.red ? 'r' : ''), W + 20, H + 40, c => {
      c.translate(10, 34);
      const base = H - 6, cx = W / 2, peak = big ? -24 : 4;
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, cx + 6, base, W / 2 + 2, 10);
      const canvas1 = p.red ? '#e2d8c2' : big ? '#d8c08a' : '#c8b48a', canvas2 = p.red ? '#a8322a' : big ? '#a8412c' : '#a89060';
      // 侧顶
      c.fillStyle = sh(canvas1, -0.25); c.beginPath(); c.moveTo(cx, peak); c.lineTo(W - 2, base - 8); c.lineTo(W * 0.62, base - 4); c.closePath(); c.fill();
      // 正面三角
      const g = c.createLinearGradient(0, peak, 0, base); g.addColorStop(0, sh(canvas1, 0.1)); g.addColorStop(1, sh(canvas1, -0.08));
      c.fillStyle = g; c.beginPath(); c.moveTo(cx, peak); c.lineTo(2, base - 4); c.lineTo(W * 0.62, base - 4); c.closePath(); c.fill();
      // 条纹
      c.save(); c.clip(); c.fillStyle = G.rgba('#000000', 0) ; c.strokeStyle = canvas2; c.lineWidth = big ? 6 : 4;
      for (let i = 1; i < 5; i++) { const t = i / 5; c.beginPath(); c.moveTo(cx + (2 - cx) * t, peak + (base - 4 - peak) * t); c.lineTo(cx + (W * 0.62 - cx) * t, peak + (base - 4 - peak) * t); c.stroke(); }
      c.restore();
      // 门帘
      const dx = W * 0.32, dh = (base - peak) * 0.48;
      c.fillStyle = '#2a1d14'; c.beginPath(); c.moveTo(dx, base - 4 - dh); c.lineTo(dx - 13, base - 4); c.lineTo(dx + 13, base - 4); c.closePath(); c.fill();
      c.fillStyle = sh(canvas1, -0.15); c.beginPath(); c.moveTo(dx, base - 4 - dh); c.lineTo(dx - 13, base - 4); c.lineTo(dx - 18, base - 4); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,25,15,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx, peak); c.lineTo(2, base - 4); c.moveTo(cx, peak); c.lineTo(W * 0.62, base - 4); c.stroke();
      // 绳索
      c.strokeStyle = '#6b5434'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(cx, peak); c.lineTo(cx - 6, peak - 8); c.moveTo(4, base - 6); c.lineTo(-6, base + 2); c.moveTo(W - 4, base - 9); c.lineTo(W + 6, base); c.stroke();
      c.fillStyle = '#5a3a22'; c.fillRect(cx - 1.5, peak - 14, 3, 14);
      if (big) {
        c.fillStyle = p.red ? '#c0392b' : '#e2b13a'; c.beginPath(); c.moveTo(cx + 1.5, peak - 14); c.lineTo(cx + 24, peak - 10); c.lineTo(cx + 1.5, peak - 4); c.fill();
        c.fillStyle = p.red ? '#2a1a14' : '#c23b2a'; c.fillRect(W * 0.32 - 20, base - 4 - dh - 18, 40, 16);
        c.fillStyle = '#f2d98a'; c.font = G.font(12, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.sign || '黄天', W * 0.32, base - 4 - dh - 10);
      }
    });
  }

  function mountainImg(v) {
    return mk('mountain_' + v, 168, 150, c => {
      const rng = G.seeded(v * 131 + 17), W = 168, base = 146;
      c.fillStyle = 'rgba(0,0,0,0.22)'; ell(c, W / 2 + 6, base - 4, 76, 14);
      const peaks = [[W * 0.5 + (rng() - 0.5) * 20, 14 + rng() * 14, 74], [W * 0.24, 56 + rng() * 14, 46], [W * 0.78, 50 + rng() * 16, 50]];
      peaks.sort((a, b) => a[1] - b[1]).reverse();
      for (const [px, py, hw] of peaks) {
        const L = px - hw - 8, Rr = px + hw + 8;
        c.fillStyle = '#5d6455'; c.beginPath(); c.moveTo(L, base); c.lineTo(px - hw * 0.35, py + 30); c.lineTo(px, py); c.lineTo(px + hw * 0.4, py + 26); c.lineTo(Rr, base); c.closePath(); c.fill();
        const g = c.createLinearGradient(0, py, 0, base); g.addColorStop(0, '#9aa08d'); g.addColorStop(1, '#6f7a5c');
        c.fillStyle = g; c.beginPath(); c.moveTo(L, base); c.lineTo(px - hw * 0.35, py + 30); c.lineTo(px, py); c.lineTo(px + 2, base); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(40,45,35,0.35)'; c.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const y = py + 18 + k * 18; c.beginPath(); c.moveTo(px + 4, y); c.lineTo(px + hw * 0.55, y + 12 + rng() * 6); c.stroke(); }
        if (py < 40) { c.fillStyle = '#eef1ec'; c.beginPath(); c.moveTo(px - 14, py + 18); c.lineTo(px, py); c.lineTo(px + 12, py + 15); c.lineTo(px + 5, py + 12); c.lineTo(px - 2, py + 19); c.lineTo(px - 7, py + 14); c.closePath(); c.fill(); }
        c.fillStyle = 'rgba(60,95,45,0.75)'; c.beginPath(); c.moveTo(L, base); c.quadraticCurveTo(px, base - 34, Rr, base); c.closePath(); c.fill();
      }
      for (let i = 0; i < 9; i++) { const x = 20 + rng() * (W - 40), y = base - 6 - rng() * 14; c.fillStyle = '#2c4a2b'; tri(c, x, y - 12, x - 5, y, x + 5, y); }
    });
  }

  function townIcon(p) {
    const W = p.w * T, H = p.h * T;
    return mk('townicon_' + p.w, W + 20, H + 30, c => {
      c.translate(10, 24);
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, W / 2 + 6, H - 6, W / 2, 12);
      c.fillStyle = '#7a7468'; c.fillRect(6, 12, W - 12, H - 22);
      c.fillStyle = '#9a958a'; c.fillRect(6, 10, W - 12, 8);
      for (let x = 6; x < W - 8; x += 9) c.fillRect(x, 4, 6, 7);
      c.fillStyle = '#5f5a50'; c.fillRect(6, H - 30, W - 12, 18);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(6, H - 26 + r * 6); c.lineTo(W - 6, H - 26 + r * 6); c.stroke(); }
      for (const [x, y, w] of [[18, 8, 52], [W - 70, 14, 50]]) { c.save(); c.translate(x, y - 20); c.fillStyle = '#d8cbb0'; c.fillRect(6, 18, w - 12, 14); drawRoof(c, w, 20, 0, '#3d4654', 6); c.restore(); }
      c.fillStyle = '#2a1d14'; c.beginPath(); c.moveTo(W / 2 - 12, H - 12); c.lineTo(W / 2 - 12, H - 24); c.quadraticCurveTo(W / 2, H - 34, W / 2 + 12, H - 24); c.lineTo(W / 2 + 12, H - 12); c.fill();
      c.save(); c.translate(W / 2 - 34, H - 62); drawRoof(c, 68, 18, 0, '#38414e', 6); c.restore();
      c.fillStyle = '#4a3424'; c.fillRect(W - 18, -18, 2, 30); c.fillStyle = '#c23b2a'; c.fillRect(W - 16, -18, 14, 9);
    });
  }
  function campIcon(p) {
    const W = p.w * T, H = p.h * T;
    return mk('campicon_' + p.w + (p.han ? 'h' : ''), W + 20, H + 30, c => {
      c.translate(10, 24);
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, W / 2 + 6, H - 6, W / 2 + 4, 13);
      c.fillStyle = '#5a4734'; ell(c, W / 2, H - 22, W / 2 - 2, H / 2 - 14);
      for (const [x, y, s] of [[W * 0.3, H * 0.45, 1], [W * 0.62, H * 0.38, 1.2], [W * 0.5, H * 0.66, 1]]) {
        c.fillStyle = p.han ? '#e2d8c2' : '#c8b48a'; tri(c, x, y - 18 * s, x - 16 * s, y + 4, x + 16 * s, y + 4);
        c.fillStyle = '#a89060'; tri(c, x, y - 18 * s, x + 16 * s, y + 4, x + 4 * s, y + 4);
        c.fillStyle = '#2a1d14'; tri(c, x - 2, y - 6, x - 7, y + 4, x + 3, y + 4);
      }
      for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU, x = W / 2 + Math.cos(a) * (W / 2 - 2), y = H - 22 + Math.sin(a) * (H / 2 - 14); if (Math.sin(a) < -0.2) continue; c.fillStyle = '#6b4a2a'; c.fillRect(x - 1.5, y - 12, 3, 12); c.fillStyle = '#c9a678'; tri(c, x - 1.5, y - 12, x, y - 15, x + 1.5, y - 12); }
      for (const x of [W * 0.15, W * 0.85, W * 0.5]) { c.fillStyle = '#4a3424'; c.fillRect(x, -10, 2, 28); c.fillStyle = p.han ? (p.flagCol || '#b8322a') : '#e2b13a'; c.beginPath(); c.moveTo(x + 2, -10); c.lineTo(x + 18, -6); c.lineTo(x + 2, -1); c.fill(); }
    });
  }

  function smallProp(type, p) {
    return mk('prop_' + type + (type === 'sign' ? (p.text || '') : ''), 100, 100, c => {
      c.translate(50, 92);
      switch (type) {
        case 'well':
          c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 4, 0, 26, 8);
          c.fillStyle = '#6e685c'; ell(c, 0, -8, 20, 9); c.fillRect(-20, -18, 40, 10); c.fillStyle = '#8f897b'; ell(c, 0, -18, 20, 8);
          c.fillStyle = '#1b2a33'; ell(c, 0, -18, 14, 5);
          c.fillStyle = '#5a3d20'; c.fillRect(-19, -50, 4, 34); c.fillRect(15, -50, 4, 34); c.fillRect(-22, -52, 44, 5);
          c.strokeStyle = '#8a7350'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -48); c.lineTo(0, -28); c.stroke();
          c.fillStyle = '#6b4a2a'; c.fillRect(-4, -30, 8, 7);
          break;
        case 'board':
          c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 3, 0, 26, 6);
          c.fillStyle = '#4a3220'; c.fillRect(-24, -44, 4, 44); c.fillRect(20, -44, 4, 44);
          c.fillStyle = '#6b4a2a'; c.fillRect(-28, -54, 56, 32); c.fillStyle = '#3d2a1a'; c.fillRect(-30, -58, 60, 6);
          c.fillStyle = '#efe3c4'; c.fillRect(-22, -50, 20, 24); c.fillRect(2, -48, 20, 22);
          c.strokeStyle = '#3a3029'; c.lineWidth = 0.8; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-6 - i * 4, -47); c.lineTo(-6 - i * 4, -29); c.stroke(); c.beginPath(); c.moveTo(18 - i * 4, -45); c.lineTo(18 - i * 4, -29); c.stroke(); }
          c.fillStyle = '#c23b2a'; circ(c, -12, -32, 2.5);
          break;
        case 'sign':
          c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 3, 0, 12, 4);
          c.fillStyle = '#5a3d20'; c.fillRect(-2, -40, 4, 40);
          c.fillStyle = '#8a6236'; c.beginPath(); c.moveTo(-18, -40); c.lineTo(16, -40); c.lineTo(22, -34); c.lineTo(16, -28); c.lineTo(-18, -28); c.closePath(); c.fill();
          c.strokeStyle = '#3a2614'; c.lineWidth = 1; c.stroke();
          c.fillStyle = '#2a1a0e'; c.font = G.font(10, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.text || '大兴山', 1, -34);
          break;
        case 'cart':
          c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, 4, -2, 40, 9);
          c.fillStyle = '#6b4a2a'; c.fillRect(-36, -26, 64, 12); c.fillStyle = '#4a3220'; c.fillRect(28, -22, 20, 3);
          for (const [x, y] of [[-26, -36], [-10, -38], [6, -36], [-18, -46], [0, -47]]) { c.fillStyle = '#c9b183'; ell(c, x, y, 10, 8); c.fillStyle = '#a8905f'; ell(c, x + 2, y + 2, 6, 4); c.strokeStyle = '#7a6440'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y - 7); c.lineTo(x + 3, y - 7); c.stroke(); }
          for (const x of [-24, 16]) { c.fillStyle = '#3a2614'; circ(c, x, -10, 10); c.fillStyle = '#7a5530'; circ(c, x, -10, 7); c.fillStyle = '#3a2614'; circ(c, x, -10, 2.4); c.strokeStyle = '#3a2614'; c.lineWidth = 1.4; for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(x, -10); c.lineTo(x + Math.cos(a) * 7, -10 + Math.sin(a) * 7); c.stroke(); } }
          break;
        case 'crates':
          c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, 4, -2, 26, 7);
          for (const [x, y, s] of [[-14, -2, 20], [8, -2, 18], [-4, -22, 18]]) {
            c.fillStyle = '#8a6236'; c.fillRect(x - s / 2, y - s, s, s); c.fillStyle = '#a87a46'; c.fillRect(x - s / 2, y - s, s, 3);
            c.strokeStyle = '#4a3220'; c.lineWidth = 1.4; c.strokeRect(x - s / 2, y - s, s, s); c.beginPath(); c.moveTo(x - s / 2, y - s); c.lineTo(x + s / 2, y); c.stroke();
          }
          break;
        case 'rack':
          c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 3, -1, 28, 6);
          c.fillStyle = '#5a3d20'; c.fillRect(-26, -30, 4, 30); c.fillRect(22, -30, 4, 30); c.fillRect(-28, -30, 56, 4); c.fillRect(-28, -10, 56, 3);
          for (let i = 0; i < 5; i++) { const x = -18 + i * 9; c.fillStyle = '#6b4a2a'; c.fillRect(x - 1, -56, 2.2, 56); c.fillStyle = '#c9d3d6'; tri(c, x - 2.5, -56, x + 0.1, -66, x + 2.7, -56); c.fillStyle = '#c0392b'; c.fillRect(x - 2, -56, 4, 3); }
          break;
        case 'jar':
          c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 2, -1, 14, 5);
          c.fillStyle = '#6a4a32'; ell(c, 0, -14, 12, 14); c.fillStyle = '#835c3e'; ell(c, -3, -17, 6, 8); c.fillStyle = '#3a2614'; ell(c, 0, -27, 7, 3);
          c.fillStyle = '#c23b2a'; c.fillRect(-6, -18, 12, 9); c.fillStyle = '#f0d48a'; c.font = G.font(8, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('酒', 0, -13.5);
          break;
      }
    });
  }

  function hallImg(p) {
    const W = p.w * T, H = p.h * T, M = 24;
    return mk(`hall_${p.w}_${p.h}_${p.sign || ''}`, W + M * 2, H + 40, c => {
      c.translate(M, 34);
      const base = H - 6, eaveY = Math.round(H * 0.46), wallTop = eaveY - 4;
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, W / 2 + 8, base + 2, W / 2 + 14, 12);
      c.fillStyle = '#8f8778'; c.fillRect(-6, base - 18, W + 12, 22); c.fillStyle = '#b2a994'; c.fillRect(-6, base - 18, W + 12, 4);
      c.fillStyle = '#9d9483'; for (let i = 0; i < 4; i++) c.fillRect(W / 2 - 26 + i * 2, base - 14 + i * 5, 52 - i * 4, 4);
      let g = c.createLinearGradient(0, wallTop, 0, base); g.addColorStop(0, '#9a3424'); g.addColorStop(1, '#b8482e');
      c.fillStyle = g; c.fillRect(6, wallTop, W - 12, base - 18 - wallTop);
      g = c.createLinearGradient(0, wallTop, 0, wallTop + 22); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(6, wallTop, W - 12, 22);
      const cols = Math.round(p.w) + 1;
      for (let i = 0; i < cols; i++) { const x = 6 + (i * (W - 20)) / (cols - 1); c.fillStyle = '#6b1d14'; c.fillRect(x, wallTop, 8, base - 18 - wallTop); c.fillStyle = 'rgba(255,220,180,0.18)'; c.fillRect(x, wallTop, 2, base - 18 - wallTop); }
      for (let i = 0; i < cols - 1; i++) { const x = 6 + (i * (W - 20)) / (cols - 1) + 12, w2 = (W - 20) / (cols - 1) - 16; if (Math.abs(x + w2 / 2 - W / 2) < 20) continue; lattice(c, x, wallTop + 16, w2, base - 18 - wallTop - 26); }
      c.fillStyle = '#3a1d14'; c.fillRect(W / 2 - 18, base - 58, 36, 40); c.fillStyle = '#8a2f20'; c.fillRect(W / 2 - 15, base - 55, 30, 37);
      c.fillStyle = '#d6b45c'; for (let r = 0; r < 4; r++) for (const sx of [-1, 1]) circ(c, W / 2 + sx * 7, base - 49 + r * 9, 1.3);
      drawRoof(c, W, eaveY, 26, p.roof || '#3a3f4a', 22);
      c.save(); c.translate(W * 0.18, -30); drawRoof(c, W * 0.64, 46, 0, p.roof || '#3a3f4a', 14); c.restore();
      if (p.sign) {
        c.font = G.font(18, true); const sw = c.measureText(p.sign).width + 22, sx = W / 2 - sw / 2, sy = eaveY - 2;
        c.fillStyle = '#1a120d'; G.rr(c, sx - 2, sy - 2, sw + 4, 30, 3); c.fill();
        c.strokeStyle = '#d9b46a'; c.lineWidth = 1.5; G.rr(c, sx + 2, sy + 2, sw - 4, 22, 2); c.stroke();
        c.fillStyle = '#f0d48a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.sign, W / 2, sy + 13.5);
      }
    });
  }
  function towerImg() {
    return mk('tower', 110, 190, c => {
      c.translate(55, 186);
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, 6, -2, 40, 9);
      c.strokeStyle = '#4a3220'; c.lineWidth = 5;
      for (const x of [-30, 30]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x * 0.7, -110); c.stroke(); }
      c.lineWidth = 2.5; c.beginPath(); c.moveTo(-28, -10); c.lineTo(21, -60); c.moveTo(28, -10); c.lineTo(-21, -60); c.moveTo(-24, -60); c.lineTo(24, -60); c.moveTo(-23, -64); c.lineTo(20, -104); c.moveTo(23, -64); c.lineTo(-20, -104); c.stroke();
      c.fillStyle = '#6b4a2a'; c.fillRect(-32, -122, 64, 16); c.fillStyle = '#8a6236'; c.fillRect(-32, -122, 64, 4);
      c.fillStyle = '#5a3d20'; for (let x = -30; x <= 26; x += 8) c.fillRect(x, -138, 3, 18);
      c.fillRect(-32, -140, 64, 3);
      c.fillStyle = '#3d4654'; c.beginPath(); c.moveTo(-42, -146); c.quadraticCurveTo(0, -160, 42, -146); c.lineTo(10, -176); c.lineTo(-10, -176); c.closePath(); c.fill();
      c.strokeStyle = '#2a3038'; c.lineWidth = 3; c.beginPath(); c.moveTo(-42, -146); c.quadraticCurveTo(0, -160, 42, -146); c.stroke();
    });
  }
  function cageImg() {
    return mk('cage', 130, 120, c => {
      c.translate(65, 112);
      c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, 4, -2, 48, 9);
      c.fillStyle = '#5a3d20'; c.fillRect(-44, -26, 84, 10); c.fillRect(40, -22, 22, 3);
      c.fillStyle = '#3a2614'; c.fillRect(-42, -78, 80, 6);
      c.fillStyle = '#6b4a2a'; for (let x = -42; x <= 36; x += 10) c.fillRect(x, -76, 4, 52);
      for (const x of [-28, 22]) { c.fillStyle = '#3a2614'; circ(c, x, -10, 11); c.fillStyle = '#7a5530'; circ(c, x, -10, 8); c.fillStyle = '#3a2614'; circ(c, x, -10, 2.4); }
    });
  }

  // 篝火（实时）
  function drawFire(c, x, y, t, seed) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, x, y - 2, 18, 6);
    c.fillStyle = '#5c5850'; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ell(c, x + Math.cos(a) * 14, y - 5 + Math.sin(a) * 5, 4, 3); }
    c.strokeStyle = '#3a2614'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 10, y - 2); c.lineTo(x + 8, y - 10); c.moveTo(x + 10, y - 2); c.lineTo(x - 8, y - 10); c.stroke(); c.lineCap = 'butt';
    const cols = ['#c0391e', '#f07a1e', '#ffc43a', '#fff2b0'];
    for (let k = 0; k < 4; k++) {
      const s = 1 - k * 0.22;
      c.fillStyle = cols[k];
      c.beginPath();
      const n = 5;
      c.moveTo(x - 11 * s, y - 6);
      for (let i = 0; i <= n; i++) {
        const fx = x - 11 * s + (22 * s * i) / n;
        const fh = (16 + Math.sin(t * 9 + i * 2.1 + seed) * 5 + Math.sin(t * 13 + i * 1.3) * 3) * s * (i === 0 || i === n ? 0.3 : 1) * (1 + (i % 2) * 0.35);
        c.lineTo(fx, y - 6 - fh); if (i < n) c.lineTo(fx + (11 * s) / n, y - 6 - fh * 0.5);
      }
      c.lineTo(x + 11 * s, y - 6); c.closePath(); c.fill();
    }
  }
  // 旗帜（实时）
  function drawFlag(c, x, y, t, col, txt, h = 80, tcol) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, x + 3, y, 7, 2.5);
    c.fillStyle = '#4a3424'; c.fillRect(x - 1.5, y - h, 3, h);
    c.fillStyle = '#c9a24a'; circ(c, x, y - h - 2, 3);
    const fw = 30, fh = 40;
    c.fillStyle = col; c.beginPath(); c.moveTo(x + 1.5, y - h + 4);
    for (let i = 0; i <= 6; i++) { const fx = x + 1.5 + (fw * i) / 6; c.lineTo(fx, y - h + 4 + Math.sin(t * 4 + i * 0.9) * 2.5 * (i / 6)); }
    for (let i = 6; i >= 0; i--) { const fx = x + 1.5 + (fw * i) / 6; c.lineTo(fx, y - h + 4 + fh + Math.sin(t * 4 + i * 0.9) * 2.5 * (i / 6)); }
    c.closePath(); c.fill();
    c.strokeStyle = sh(col, -0.35); c.lineWidth = 2; c.stroke();
    if (txt) { G.text(c, txt, x + 1.5 + fw / 2, y - h + 4 + fh / 2 + Math.sin(t * 4 + 3) * 1.2, { size: 18, bold: true, align: 'center', color: tcol || '#3a1a0e' }); }
  }
  A.drawFlag = drawFlag;
  A.drawFire = drawFire;

  // 统一的道具绘制入口；返回 true 表示已画
  A.drawProp = function (c, p, t) {
    const X = p.x * T, Y = p.y * T;
    switch (p.type) {
      case 'house': { const img = houseImg(p); c.drawImage(img, X - 20, Y - 6, img.lw, img.lh); break; }
      case 'pavilion': {
        const img = pavilionImg(p); c.drawImage(img, X - 20, Y - 34, img.lw, img.lh);
        // 香烟
        const sx = X + p.w * T / 2, sy = Y + p.h * T * 0.62 - 28 - 34 + 34;
        c.save(); c.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          c.strokeStyle = `rgba(235,230,220,${0.32 - k * 0.08})`; c.lineWidth = 2.2 - k * 0.4;
          c.beginPath(); c.moveTo(sx + (k - 1) * 3, sy);
          for (let i = 1; i <= 10; i++) c.lineTo(sx + (k - 1) * 3 + Math.sin(t * 1.4 + i * 0.6 + k * 2) * (2 + i * 0.9), sy - i * 6);
          c.stroke();
        }
        c.restore();
        break;
      }
      case 'gate': { const img = gateImg(p); c.drawImage(img, X - 15, Y - 90, img.lw, img.lh); break; }
      case 'tent': { const img = tentImg(p, false); c.drawImage(img, X - 10, Y - 34, img.lw, img.lh); break; }
      case 'bigtent': { const img = tentImg(p, true); c.drawImage(img, X - 10, Y - 34, img.lw, img.lh); break; }
      case 'mountain': { const img = mountainImg(p.v || 0); c.drawImage(img, X + p.w * T / 2 - 84, Y + p.h * T - 146, img.lw, img.lh); break; }
      case 'townicon': case 'campicon': {
        const img = p.type === 'townicon' ? townIcon(p) : campIcon(p);
        c.drawImage(img, X - 10, Y - 24, img.lw, img.lh);
        if (p.label) {
          c.font = G.font(16, true); const w = c.measureText(p.label).width + 18, lx = X + p.w * T / 2;
          c.fillStyle = 'rgba(20,14,10,0.78)'; G.rr(c, lx - w / 2, Y - 46, w, 24, 4); c.fill();
          c.strokeStyle = '#c9a24a'; c.lineWidth = 1; c.stroke();
          G.text(c, p.label, lx, Y - 33.5, { size: 16, bold: true, align: 'center', color: '#f1dca0' });
        }
        break;
      }
      case 'hall': { const img = hallImg(p); c.drawImage(img, X - 24, Y - 34, img.lw, img.lh); break; }
      case 'tower': { const img = towerImg(); c.drawImage(img, X + p.w * T / 2 - 55, Y + p.h * T - 186, img.lw, img.lh); break; }
      case 'cage': {
        const img = cageImg(); c.drawImage(img, X + p.w * T / 2 - 65, Y + p.h * T - 112, img.lw, img.lh);
        if (p.who) { c.save(); c.translate(X + p.w * T / 2, Y + p.h * T - 30); A.drawChar(c, G.SPECS[p.who], 'down', 0, { noShadow: true }); c.restore(); c.fillStyle = '#6b4a2a'; for (let x = -42; x <= 36; x += 10) c.fillRect(X + p.w * T / 2 + x, Y + p.h * T - 112 + 36, 4, 52); }
        break;
      }
      case 'fire': drawFire(c, X + T / 2, Y + T - 8, t, p.x * 3 + p.y); break;
      case 'flag': drawFlag(c, X + T / 2 - 14, Y + T * p.h - 6, t + p.x, p.color || '#e2b13a', p.text || '黄', 80, p.tcol); break;
      default: { const img = smallProp(p.type, p); c.drawImage(img, X + p.w * T / 2 - 50, Y + p.h * T - 92 - 4, img.lw, img.lh); }
    }
  };

  /* ==========================================================
   * 战斗背景
   * ========================================================== */
  function ridge(c, y0, amp, seed, col, W, H, step = 6) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += step) c.lineTo(x, y0 - G.fbm(x / 140, seed, seed) * amp - G.noise(x / 40, seed + 3, seed) * amp * 0.2);
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  const BG = {
    field: { sky: ['#6f9cc4', '#b9cfd8', '#efe0bd'], sun: [760, 96, 30, '#fffbe8', 'rgba(255,250,220,0.75)'], cloud: 'rgba(255,255,255,0.55)', ridges: ['#8aa1b6', '#7a937f', '#5d7b52'], mist: 'rgba(255,255,255,0.45)', horizon: 'trees', tree: '#3f5e35', ground: ['#7e9a48', '#3f5e26'], patch: 'rgba(150,125,80,0.35)', blade: ['rgba(170,200,100,', 'rgba(30,60,20,'] },
    camp: { sky: ['#2a1d3f', '#8a3d4a', '#f09a55'], sun: [640, 200, 44, '#ffb070', 'rgba(255,170,90,0.55)'], cloud: 'rgba(60,25,45,0.35)', ridges: ['#5a3550', '#45283f', '#2e1d2c'], mist: 'rgba(240,140,90,0.3)', horizon: 'tents', sil: '#24161f', ground: ['#5a4433', '#2a1f17'], patch: 'rgba(120,85,60,0.35)', blade: ['rgba(150,110,70,', 'rgba(20,12,8,'], embers: true },
    boss: { sky: ['#1a0e1e', '#6a1f22', '#e0643a'], sun: [640, 200, 44, '#ffb070', 'rgba(255,170,90,0.55)'], cloud: 'rgba(60,25,45,0.35)', ridges: ['#4a1f2a', '#381824', '#24121a'], mist: 'rgba(240,140,90,0.3)', horizon: 'tents', sil: '#1a0c12', ground: ['#5a4433', '#2a1f17'], patch: 'rgba(120,85,60,0.35)', blade: ['rgba(150,110,70,', 'rgba(20,12,8,'], embers: true },
    autumn: { sky: ['#7d9fbf', '#d6cfb2', '#f3d9a2'], sun: [720, 110, 32, '#fff3d0', 'rgba(255,230,180,0.7)'], cloud: 'rgba(255,250,240,0.55)', ridges: ['#a3a08f', '#958a62', '#7d6a38'], mist: 'rgba(255,245,220,0.45)', horizon: 'trees', tree: '#9a6a2a', ground: ['#b89c4c', '#6a5524'], patch: 'rgba(140,110,60,0.35)', blade: ['rgba(230,200,110,', 'rgba(90,60,20,'] },
    rain: { sky: ['#2f363e', '#4c555c', '#6b7376'], sun: null, cloud: 'rgba(30,34,40,0.6)', ridges: ['#4c565c', '#3e4a45', '#2f3c30'], mist: 'rgba(160,170,175,0.35)', horizon: 'trees', tree: '#26382a', ground: ['#475a30', '#25321a'], patch: 'rgba(60,70,60,0.4)', blade: ['rgba(120,150,90,', 'rgba(15,25,12,'], rain: true },
    pass: { sky: ['#b8875a', '#e2bc86', '#f2dcae'], sun: [700, 120, 34, '#fff0c8', 'rgba(255,220,160,0.65)'], cloud: 'rgba(255,240,215,0.45)', ridges: ['#b38c62', '#9c7650', '#7f5c3c'], mist: 'rgba(250,225,180,0.4)', horizon: 'wall', sil: '#6a4e36', ground: ['#a98b5c', '#5a432c'], patch: 'rgba(120,90,60,0.35)', blade: ['rgba(210,180,120,', 'rgba(70,50,30,'] },
    city: { sky: ['#6f9cc4', '#c4d4d8', '#efe2c0'], sun: [740, 100, 30, '#fffbe8', 'rgba(255,250,220,0.75)'], cloud: 'rgba(255,255,255,0.55)', ridges: ['#8aa1b6', '#7a937f', '#5d7b52'], mist: 'rgba(255,255,255,0.45)', horizon: 'wall', sil: '#6b675e', ground: ['#86965a', '#4a5a30'], patch: 'rgba(150,130,90,0.35)', blade: ['rgba(170,200,100,', 'rgba(30,60,20,'] },
    snow: { sky: ['#8ea4b8', '#c8d2da', '#e8ecef'], sun: [720, 110, 28, '#ffffff', 'rgba(255,255,255,0.6)'], cloud: 'rgba(250,252,255,0.6)', ridges: ['#b4c0cc', '#9eacb4', '#8494a0'], mist: 'rgba(255,255,255,0.5)', horizon: 'trees', tree: '#4a5a58', ground: ['#e4e8ec', '#a8b2ba'], patch: 'rgba(160,170,180,0.35)', blade: ['rgba(255,255,255,', 'rgba(120,130,140,'], snow: true },
    flood: { sky: ['#3a4250', '#5c6670', '#808a90'], sun: null, cloud: 'rgba(40,46,55,0.55)', ridges: ['#5a646c', '#4a5458', '#3a4446'], mist: 'rgba(170,180,190,0.4)', horizon: 'wall', sil: '#3e3c38', ground: ['#4e6470', '#26343c'], patch: 'rgba(120,150,170,0.3)', blade: ['rgba(170,200,220,', 'rgba(20,30,40,'], rain: true },
  };
  A.BG = BG;
  function ridge(c, y0, amp, seed, col, W, H, step = 6) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += step) c.lineTo(x, y0 - G.fbm(x / 140, seed, seed) * amp - G.noise(x / 40, seed + 3, seed) * amp * 0.2);
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  A.battleBg = function (kind) {
    const W = G.W, H = G.H, cfg = BG[kind] || BG.field;
    return mk('bbg_' + kind, W, H, c => {
      const hor = 250, rng = G.seeded(kind.length * 77 + kind.charCodeAt(0));
      let g = c.createLinearGradient(0, 0, 0, hor);
      g.addColorStop(0, cfg.sky[0]); g.addColorStop(0.6, cfg.sky[1]); g.addColorStop(1, cfg.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, hor + 10);
      if (cfg.sun) {
        const [sx, sy, sr, col, glow] = cfg.sun;
        g = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 5); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(255,200,150,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, hor + 10); c.fillStyle = col; circ(c, sx, sy, sr);
      }
      for (let i = 0; i < (cfg.sun ? 7 : 14); i++) {
        const cx = rng() * W, cy = 20 + rng() * (cfg.sun ? 130 : 160), w = 80 + rng() * 160;
        c.fillStyle = cfg.cloud;
        for (let k = 0; k < 6; k++) ell(c, cx + (k - 3) * w * 0.16, cy + Math.sin(k) * 4, w * 0.18, 10 + rng() * 8);
      }
      ridge(c, 200, 90, 1, cfg.ridges[0], W, H);
      g = c.createLinearGradient(0, 160, 0, 240); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, cfg.mist); c.fillStyle = g; c.fillRect(0, 150, W, 100);
      ridge(c, 236, 60, 2, cfg.ridges[1], W, H);
      ridge(c, 262, 30, 3, cfg.ridges[2], W, H, 4);
      if (cfg.horizon === 'tents') {
        c.fillStyle = cfg.sil;
        for (let i = 0; i < 9; i++) { const x = 40 + i * 110 + rng() * 30, s = 0.7 + rng() * 0.6; tri(c, x, 238 - 30 * s, x - 26 * s, 262, x + 26 * s, 262); }
        for (let x = 0; x < W; x += 9) { c.fillRect(x, 248, 5, 16); tri(c, x, 248, x + 2.5, 243, x + 5, 248); }
        for (const x of [120, 400, 700, 880]) { c.fillRect(x, 190, 2.5, 60); c.beginPath(); c.moveTo(x + 2.5, 190); c.lineTo(x + 26, 196); c.lineTo(x + 2.5, 204); c.fill(); }
      } else if (cfg.horizon === 'wall') {
        c.fillStyle = cfg.sil; c.fillRect(0, 214, W, 52);
        for (let x = 0; x < W; x += 22) c.fillRect(x, 204, 14, 12);
        c.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 222; y < 266; y += 9) c.fillRect(0, y, W, 1.5);
        const gx = W * 0.62; c.fillStyle = G.shade(cfg.sil, -0.35); c.beginPath(); c.moveTo(gx - 34, 266); c.lineTo(gx - 34, 236); c.quadraticCurveTo(gx, 214, gx + 34, 236); c.lineTo(gx + 34, 266); c.fill();
        c.fillStyle = G.shade(cfg.sil, -0.15); c.fillRect(gx - 70, 168, 140, 40);
        c.fillStyle = G.shade(cfg.sil, -0.3); c.beginPath(); c.moveTo(gx - 92, 172); c.quadraticCurveTo(gx, 156, gx + 92, 172); c.lineTo(gx + 56, 140); c.lineTo(gx - 56, 140); c.closePath(); c.fill();
        for (const x of [90, 300, 760, 900]) { c.fillStyle = G.shade(cfg.sil, -0.3); c.fillRect(x, 168, 2.5, 40); c.fillStyle = kind === 'pass' ? '#3a2a40' : '#a8322a'; c.beginPath(); c.moveTo(x + 2.5, 168); c.lineTo(x + 24, 174); c.lineTo(x + 2.5, 182); c.fill(); }
      } else {
        for (let i = 0; i < 40; i++) { const x = rng() * W, y = 262 + rng() * 6, s = 0.5 + rng() * 0.6; c.fillStyle = cfg.tree; ell(c, x, y - 8 * s, 10 * s, 12 * s); }
      }
      g = c.createLinearGradient(0, 260, 0, H); g.addColorStop(0, cfg.ground[0]); g.addColorStop(1, cfg.ground[1]);
      c.fillStyle = g; c.fillRect(0, 264, W, H - 264);
      c.fillStyle = cfg.patch; ell(c, W / 2, 330, 420, 70);
      c.lineCap = 'round';
      for (let i = 0; i < 900; i++) {
        const y = 266 + Math.pow(rng(), 0.8) * (H - 266), x = rng() * W, s = (y - 260) / (H - 260), len = 3 + s * 12;
        c.strokeStyle = cfg.blade[rng() < 0.5 ? 0 : 1] + (0.3 + s * 0.3) + ')';
        c.lineWidth = 0.8 + s * 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rng() - 0.5) * 5, y - len); c.stroke();
      }
      for (let i = 0; i < 40; i++) { const x = rng() * W, y = 290 + rng() * 200, s = (y - 260) / 280; c.fillStyle = 'rgba(80,75,65,0.6)'; ell(c, x, y, 4 + s * 6, 2 + s * 3); }
      if (kind === 'flood') { c.fillStyle = 'rgba(90,130,160,0.35)'; for (let i = 0; i < 30; i++) ell(c, rng() * W, 300 + rng() * 220, 40 + rng() * 80, 4 + rng() * 6); }
      c.lineCap = 'butt';
      g = c.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, W * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
  };

  A.vignette = function () {
    return mk('vignette', G.W, G.H, c => {
      const g = c.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.45, G.W / 2, G.H / 2, G.W * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,0,0.42)');
      c.fillStyle = g; c.fillRect(0, 0, G.W, G.H);
    }, 1);
  };

  // 水墨山水（标题画面）
  A.inkLandscape = function () {
    return mk('ink', G.W, G.H, c => {
      const W = G.W, H = G.H;
      let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#efe7d3'); g.addColorStop(1, '#d9ccad');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const rng = G.seeded(42);
      for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(120,95,60,${rng() * 0.05})`; c.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 2); }
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(150,120,80,${rng() * 0.05})`; c.lineWidth = 0.6; c.beginPath(); const x = rng() * W, y = rng() * H; c.moveTo(x, y); c.lineTo(x + (rng() - 0.5) * 40, y + rng() * 30); c.stroke(); }
      // 远山层次
      const layers = [[300, 150, 'rgba(70,75,80,0.18)', 11], [350, 140, 'rgba(50,55,60,0.28)', 12], [410, 120, 'rgba(35,38,42,0.45)', 13], [480, 70, 'rgba(25,26,28,0.75)', 14]];
      for (const [y0, amp, col, s] of layers) {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 4) {
          const n = G.fbm(x / 160, s, s), peak = Math.pow(n, 2.2);
          c.lineTo(x, y0 - peak * amp * 1.8 - G.noise(x / 25, s, s) * 6);
        }
        c.lineTo(W, H); c.closePath(); c.fill();
        g = c.createLinearGradient(0, y0 - 40, 0, y0 + 40); g.addColorStop(0, 'rgba(239,231,211,0)'); g.addColorStop(1, 'rgba(239,231,211,0.75)');
        c.fillStyle = g; c.fillRect(0, y0 - 40, W, 80);
      }
      // 松
      function pine(x, y, s) {
        c.strokeStyle = 'rgba(20,18,16,0.85)'; c.lineWidth = 3 * s; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10 * s, y - 40 * s, x - 6 * s, y - 90 * s); c.stroke();
        c.fillStyle = 'rgba(20,22,20,0.8)';
        for (const [dx, dy, w] of [[-6, -90, 30], [6, -70, 36], [-14, -52, 30], [10, -40, 26]]) { ell(c, x + dx * s, y + dy * s, w * s, 6 * s); ell(c, x + dx * s + 6 * s, y + dy * s - 4 * s, w * 0.6 * s, 4 * s); }
      }
      pine(90, 520, 1.6); pine(880, 530, 1.3);
    }, 1);
  };
})();
