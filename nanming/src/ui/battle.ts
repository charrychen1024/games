/* 战斗画面：三路对阵，逐回合下令，动画演示冲锋、齐射、接战、溃退。
 * 规则全在 core/battle.ts；这里只收集选择、播放结果。 */
import type { GameState } from '../core/types';
import {
  resolveRound, aiChoice, legalOrders, legalStratagems, stratagemOdds, sideTroops, laneActive,
  ORDER_NAME, ORDER_HINT, STRATAGEM_NAME, STRATAGEM_HINT, LANE_NAMES, outcomeText, lossesOf,
  type BattleState, type Choice, type LaneOrder, type Stratagem,
} from '../core/battle';
import { h, $, clear, wan } from './dom';
import { iconSvg } from './icons';
import { beat, gong } from './audio';
import { drawFlag, iconPath } from '../render/map';
import { POLITIES } from '../data/factions';
import { makeRng } from '../core/rng';

const ic = (name: string) => { const sp = h('span', { style: { display: 'contents' } }); sp.innerHTML = iconSvg(name); return sp; };
const ORDER_ICON: Record<string, string> = { attack: 'attack', hold: 'hold', flank: 'flank', volley: 'volley', charge: 'charge', withdraw: 'withdraw', storm: 'storm', bombard: 'bombard', sap: 'sap', blockade: 'blockade', sortie: 'sortie', repair: 'repair' };
const STRAT_ICON: Record<string, string> = { ambush: 'ambush', fire: 'fire', night: 'night', persuade: 'persuade' };
const meterEl = (v: number) => h('div', { class: 'meter' }, h('i', { style: { width: Math.max(0, Math.min(100, v)) + '%', background: v >= 50 ? 'var(--green)' : v >= 25 ? 'var(--amber)' : 'var(--red-2)' } }));
interface Anim { from: BattleState; to: BattleState; start: number; dur: number }
const WEATHER_NAME = { clear: '晴', rain: '雨', wind: '大风', fog: '雾' };
const TERRAIN_NAME = { plain: '平野', river: '临江', hills: '山隘', city: '城下' };

export function playBattle(s: GameState, b0: BattleState, side: 'att' | 'def', fast = false): Promise<{ result: BattleState; manual: boolean }> {
  return new Promise(resolve => {
    const root = $('#battle'), ui = $('#battle-ui'), canvas = $('#battle') .querySelector('canvas') as HTMLCanvasElement;
    root.classList.remove('hidden');
    const g = canvas.getContext('2d')!;
    const foe: 'att' | 'def' = side === 'att' ? 'def' : 'att';
    let cur = b0;
    let anim: Anim | null = null;
    let manual = false;
    let choice: Choice = aiChoice(cur, side);
    choice.stratagem = undefined;
    let raf = 0;
    let busy = false;
    const colorOf = (f: string) => s.factions[f]?.color ?? '#777';
    const polOf = (f: string) => POLITIES[s.factions[f]?.polity ?? 'none'];

    function size() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    /* ---------- 画面 ---------- */
    let lastW = 0, lastH = 0;
    function frame(now: number) {
      const r = canvas.getBoundingClientRect();
      if (r.width !== lastW || r.height !== lastH) { lastW = r.width; lastH = r.height; size(); }
      const W = r.width, H = r.height;
      let t = 1, show = cur, next: BattleState | null = null;
      if (anim) {
        t = Math.min(1, (now - anim.start) / anim.dur);
        show = anim.from; next = anim.to;
        if (t >= 1) { cur = anim.to; anim = null; busy = false; renderUI(); if (cur.over) { gong(cur.winner === side); } }
      }
      drawField(W, H, show);
      const log = next ? next.log[next.log.length - 1] : null;
      for (let i = 0; i < 3; i++) {
        const y = H * (0.2 + i * 0.3);
        for (const sd of ['att', 'def'] as const) {
          const from = show[sd].lanes[i], to = next ? next[sd].lanes[i] : from;
          const order = log ? (sd === 'att' ? log.lanes[i]?.att : log.lanes[i]?.def) : undefined;
          drawLane(W, H, y, sd, show, from, to, order, t, i);
        }
        // 伤亡数字
        if (log && t > 0.35 && t < 1) {
          const ev = log.lanes[i];
          if (ev) {
            const a = (t - 0.35) / 0.65;
            g.globalAlpha = 1 - a;
            g.font = '700 18px "Noto Serif SC", serif'; g.textAlign = 'center';
            if (ev.attLoss) { g.fillStyle = '#ffd9c9'; g.fillText('-' + wan(ev.attLoss), W * 0.3, y - 40 - a * 30); }
            if (ev.defLoss) { g.fillStyle = '#ffd9c9'; g.fillText('-' + wan(ev.defLoss), W * 0.7, y - 40 - a * 30); }
            g.globalAlpha = 1;
          }
        }
      }
      // 计策
      if (log && log.stratagems.length && t < 0.6) {
        const st = log.stratagems[0];
        g.save();
        if (st.kind === 'night' && st.ok) { g.fillStyle = `rgba(10,10,30,${0.5 * (1 - t / 0.6)})`; g.fillRect(0, 0, W, H); }
        if (st.kind === 'fire' && st.ok) {
          const rng = makeRng(next!.round * 77);
          const x0 = st.side === 'att' ? W * 0.62 : W * 0.18;
          for (let k = 0; k < 90; k++) { const x = x0 + rng.next() * W * 0.22, y = H * 0.1 + rng.next() * H * 0.8 - t * 80 * rng.next(); g.fillStyle = `rgba(${230 + rng.int(0, 25)},${90 + rng.int(0, 90)},20,${0.7 - t})`; g.beginPath(); g.arc(x, y, 3 + rng.next() * 6, 0, Math.PI * 2); g.fill(); }
        }
        g.fillStyle = 'rgba(40,20,10,0.75)'; g.fillRect(W / 2 - 170, H * 0.06, 340, 40);
        g.fillStyle = st.ok ? '#ffe7b0' : '#d8c8b0'; g.font = '700 20px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(`${st.side === side ? '我军' : '敌军'}${STRATAGEM_NAME[st.kind]}${st.ok ? '得手！' : '未成'}`, W / 2, H * 0.06 + 20);
        g.restore();
      }
      if (cur.over && !anim) drawResult(W, H);
      raf = requestAnimationFrame(frame);
    }

    function drawField(W: number, H: number, b: BattleState) {
      const grd = g.createLinearGradient(0, 0, 0, H);
      if (b.kind === 'siege') { grd.addColorStop(0, '#6f6a55'); grd.addColorStop(1, '#4c4636'); }
      else if (b.terrain === 'river') { grd.addColorStop(0, '#5f7466'); grd.addColorStop(1, '#4d5a46'); }
      else if (b.terrain === 'hills') { grd.addColorStop(0, '#6b6a4a'); grd.addColorStop(1, '#4b4a33'); }
      else { grd.addColorStop(0, '#7a7350'); grd.addColorStop(1, '#585236'); }
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      const rng = makeRng(42);
      g.strokeStyle = 'rgba(30,25,15,0.25)'; g.lineWidth = 1;
      for (let k = 0; k < 260; k++) { const x = rng.next() * W, y = rng.next() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 5); g.stroke(); }
      if (b.terrain === 'hills') { g.fillStyle = 'rgba(40,45,30,0.35)'; for (let k = 0; k < 5; k++) { const x = k * W / 4; g.beginPath(); g.moveTo(x - 120, H); g.quadraticCurveTo(x, H * 0.55, x + 120, H); g.fill(); } }
      if (b.terrain === 'river') { g.fillStyle = 'rgba(90,130,140,0.5)'; g.fillRect(W * 0.47, 0, W * 0.06, H); }
      // 分路虚线
      g.strokeStyle = 'rgba(255,240,210,0.12)'; g.setLineDash([8, 8]);
      for (const f of [0.35, 0.65]) { g.beginPath(); g.moveTo(0, H * f); g.lineTo(W, H * f); g.stroke(); }
      g.setLineDash([]);
      if (b.kind === 'siege') drawWall(W, H, b);
      // 天气
      if (b.weather === 'rain') { g.strokeStyle = 'rgba(200,210,220,0.25)'; for (let k = 0; k < 140; k++) { const x = (rng.next() * W + performance.now() / 3) % W, y = (rng.next() * H + performance.now() / 2) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 10); g.stroke(); } }
      if (b.weather === 'fog') { g.fillStyle = 'rgba(220,220,210,0.18)'; g.fillRect(0, 0, W, H); }
      // 顶部对阵牌
      const plate = (x: number, align: 'left' | 'right', sd: 'att' | 'def') => {
        const sideObj = b[sd];
        const w = 300, h = 46;
        const x0 = align === 'left' ? x : x - w;
        g.fillStyle = 'rgba(15,10,6,0.78)'; g.fillRect(x0, 10, w, h);
        g.fillStyle = colorOf(sideObj.faction); g.fillRect(align === 'left' ? x0 : x0 + w - 6, 10, 6, h);
        g.textBaseline = 'middle'; g.textAlign = align;
        const tx = align === 'left' ? x0 + 16 : x0 + w - 16;
        g.fillStyle = '#f0cf86'; g.font = '700 17px "Noto Serif SC", serif';
        g.fillText(`${sideObj.commanderName}${sd === side ? ' · 我军' : ''}`, tx, 26);
        g.fillStyle = '#b8a17c'; g.font = '500 12px "Noto Serif SC", serif';
        g.fillText(`${sideObj.name} · ${wan(sideTroops(sideObj))} 人`, tx, 44);
      };
      plate(14, 'left', 'att');
      plate(W - 14, 'right', 'def');
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(15,10,6,0.7)'; g.fillRect(W / 2 - 150, 14, 300, 30);
      g.fillStyle = '#f3e6c8'; g.font = '600 13.5px "Noto Serif SC", serif';
      g.fillText(`${b.nodeName}${b.kind === 'siege' ? '攻城战' : '野战'} · ${TERRAIN_NAME[b.terrain]} · ${WEATHER_NAME[b.weather]} · ${b.round}/${b.maxRounds}`, W / 2, 29);
    }

    function drawWall(W: number, H: number, b: BattleState) {
      const x = W * 0.84;
      g.fillStyle = 'rgba(70,90,95,0.6)'; g.fillRect(x - 46, 0, 22, H); // 护城河
      g.fillStyle = '#857a63'; g.fillRect(x, 0, W * 0.16, H);
      g.fillStyle = '#6e6450';
      for (let y = 0; y < H; y += 18) { g.fillRect(x - 10, y, 10, 11); }
      g.strokeStyle = 'rgba(30,25,15,0.5)'; g.lineWidth = 1;
      for (let y = 0; y < H; y += 12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + W * 0.16, y); g.stroke(); }
      // 城门
      g.fillStyle = '#3a2a1c'; g.beginPath(); g.moveTo(x, H * 0.44); g.lineTo(x + 24, H * 0.44); g.lineTo(x + 24, H * 0.56); g.lineTo(x, H * 0.56); g.fill();
      // 裂痕
      const dmg = 1 - b.wall / 100;
      const rng = makeRng(7);
      g.strokeStyle = 'rgba(20,15,10,0.7)'; g.lineWidth = 1.5;
      for (let k = 0; k < dmg * 18; k++) { const y = rng.next() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + rng.next() * 20, y + (rng.next() - 0.5) * 30); g.stroke(); }
      // 城防条
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 8, H - 26, W * 0.14, 12);
      g.fillStyle = b.wall > 50 ? '#d8c690' : b.wall > 25 ? '#d99a4e' : '#c0392b'; g.fillRect(x + 8, H - 26, W * 0.14 * b.wall / 100, 12);
      g.fillStyle = '#f3e9d2'; g.font = '600 12px "Noto Serif SC", serif'; g.textAlign = 'left'; g.textBaseline = 'bottom';
      g.fillText(`城防 ${Math.round(b.wall)}`, x + 8, H - 28);
    }

    function drawLane(W: number, H: number, y: number, sd: 'att' | 'def', b: BattleState, from: BattleState['att']['lanes'][0], to: BattleState['att']['lanes'][0], order: LaneOrder | undefined, t: number, idx: number) {
      const dir = sd === 'att' ? 1 : -1;
      const baseX = sd === 'att' ? W * 0.2 : (b.kind === 'siege' ? W * 0.8 : W * 0.8);
      let dx = 0, dy = 0, shake = 0, alpha = 1;
      const adv = t < 0.35 ? t / 0.35 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const charge = (order === 'attack' || order === 'storm' || order === 'sortie') ? 0.24 : order === 'charge' ? 0.3 : order === 'flank' ? 0.2 : order === 'withdraw' || order === 'blockade' ? -0.08 : 0;
      if (order) { dx = dir * W * charge * adv; if (order === 'flank') dy = Math.sin(adv * Math.PI) * 40 * (idx === 1 ? 1 : idx === 0 ? -1 : 1); }
      if (b.kind === 'siege' && sd === 'def' && order !== 'sortie') dx = 0;
      if (t > 0.35 && t < 0.7 && order && order !== 'withdraw' && order !== 'blockade') shake = Math.sin(t * 90) * 2.5;
      const routed = to.routed && !from.routed;
      if (routed && t > 0.6) { dx = -dir * W * 0.35 * (t - 0.6) / 0.4; alpha = 1 - (t - 0.6) / 0.4; }
      if (from.routed || (from.withdrawn && to.withdrawn)) alpha = 0.25;
      const troops = from.troops + (to.troops - from.troops) * Math.min(1, Math.max(0, (t - 0.35) / 0.35));
      const side = b[sd];
      const col = colorOf(side.faction);
      g.save();
      g.globalAlpha = Math.max(0, alpha);
      g.translate(baseX + dx + shake, y + dy);
      // 兵阵：按兵力与兵种画出阵列，每枚代表一队
      const n = Math.max(3, Math.min(24, Math.round(Math.sqrt(troops) / 6)));
      const cols = Math.min(8, Math.ceil(n / 3)), rows = Math.ceil(n / cols);
      const kinds: string[] = [];
      const mix = side.mix;
      const order3 = [['cav', mix.cav], ['gun', mix.gun], ['inf', mix.inf + mix.navy]] as [string, number][];
      for (const [k, v] of order3) for (let q = 0; q < Math.round(v * n); q++) kinds.push(k);
      while (kinds.length < n) kinds.push('inf');
      for (let q = 0; q < n; q++) {
        const c = q % cols, r = Math.floor(q / cols);
        const px = -dir * (c * 21 + (r % 2) * 10), py = (r - (rows - 1) / 2) * 22;
        g.beginPath(); g.arc(px, py, 9.5, 0, Math.PI * 2);
        g.fillStyle = col; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,240,210,0.75)'; g.stroke();
        const icon = kinds[q] === 'cav' ? 'charge' : kinds[q] === 'gun' ? 'volley' : 'inf';
        g.save();
        g.translate(px, py);
        if (dir < 0) g.scale(-1, 1);
        g.translate(-7.5, -7.5); g.scale(15 / 512, 15 / 512);
        g.fillStyle = '#fff6e0'; g.fill(iconPath(icon));
        g.restore();
      }
      const rowsH = rows * 11;
      // 军旗
      const pol = polOf(side.faction);
      g.strokeStyle = '#1b130c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(dir * 18, rowsH); g.lineTo(dir * 18, -rowsH - 26); g.stroke();
      drawFlag(g, dir * 18, -rowsH - 26, pol?.flag ?? 'rect', col, idx === 1 ? side.commanderName.slice(0, 1) : LANE_NAMES[b.kind][idx].slice(0, 1), 1.6, '#1b130c');
      // 齐射烟与箭
      if ((order === 'volley' || order === 'bombard') && t > 0.15 && t < 0.75) {
        const a = (t - 0.15) / 0.6;
        g.fillStyle = `rgba(230,230,220,${0.55 * (1 - a)})`;
        for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(dir * (16 + k * 6), -10 + (k % 3) * 10, 8 + a * 12, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = order === 'bombard' ? 'rgba(40,30,20,0.9)' : 'rgba(250,240,200,0.8)'; g.lineWidth = order === 'bombard' ? 3 : 1.2;
        for (let k = 0; k < 5; k++) { const x = dir * (30 + a * W * 0.45); g.beginPath(); g.moveTo(x, -18 + k * 9); g.lineTo(x + dir * 14, -20 + k * 9); g.stroke(); }
      }
      g.restore();
      // 兵数、士气
      g.save();
      g.globalAlpha = from.routed ? 0.5 : 1;
      const lx = sd === 'att' ? W * 0.04 : W * (b.kind === 'siege' ? 0.62 : 0.86);
      g.fillStyle = 'rgba(20,15,10,0.55)'; g.fillRect(lx, y + 34, 120, 30);
      g.fillStyle = '#f3e9d2'; g.font = '600 13px "Noto Serif SC", serif'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`${LANE_NAMES[b.kind][idx]} ${wan(troops)}${from.routed ? ' 溃' : from.withdrawn ? ' 退' : ''}`, lx + 6, y + 36);
      const mor = from.morale + (to.morale - from.morale) * Math.max(0, (t - 0.35) / 0.65);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(lx + 6, y + 54, 108, 5);
      g.fillStyle = mor > 50 ? '#e8d9a8' : mor > 25 ? '#d99a4e' : '#c0392b'; g.fillRect(lx + 6, y + 54, 108 * mor / 100, 5);
      g.restore();
    }

    function drawResult(W: number, H: number) {
      const win = cur.winner === side;
      g.fillStyle = 'rgba(20,12,6,0.55)'; g.fillRect(0, H * 0.36, W, H * 0.28);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 46px "Ma Shan Zheng", "Noto Serif SC", serif'; g.fillStyle = win ? '#f2d27a' : '#d9c1a8';
      g.fillText(win ? '胜' : '败', W / 2, H * 0.44);
      g.font = '600 17px "Noto Serif SC", serif'; g.fillStyle = '#f3e9d2';
      g.fillText(outcomeText(cur), W / 2, H * 0.53);
      g.font = '500 14px "Noto Serif SC", serif';
      g.fillText(`我军折损 ${wan(lossesOf(cur, side))} · 敌军折损 ${wan(lossesOf(cur, foe))}`, W / 2, H * 0.59);
    }

    /* ---------- 操作面板 ---------- */
    function renderUI() {
      clear(ui);
      const me = cur[side], them = cur[foe];
      const left = h('div');
      const coin = (f: string, name: string) => h('div', { class: 'coin', style: { background: colorOf(f) } }, name.slice(0, 1));
      left.append(h('div', { class: 'bhead' },
        h('div', { class: 'side' }, coin(me.faction, me.commanderName), h('div', null, h('b', null, wan(sideTroops(me))), h('div', { style: { fontSize: '11.5px', color: 'var(--dim)' } }, `${me.commanderName} · 统${me.tong} 谋${me.mou}`))),
        h('span', { class: 'vsx' }, '对'),
        h('div', { class: 'side' }, coin(them.faction, them.commanderName), h('div', null, h('b', null, wan(sideTroops(them))), h('div', { style: { fontSize: '11.5px', color: 'var(--dim)' } }, them.commanderName))),
        h('div', { style: { flex: '1' } }),
        cur.kind === 'siege' ? h('div', { class: 'pill' }, ic('wall'), h('b', null, String(Math.round(cur.wall))), h('small', null, '城防')) : null,
        h('div', { class: 'pill' }, ic('hourglass'), h('b', null, `${Math.min(cur.round + 1, cur.maxRounds)}/${cur.maxRounds}`), h('small', null, '回合'))));
      const lanes = h('div', { class: 'lanes' });
      const legal = legalOrders(cur, side);
      const hint = h('span', { class: 'hintline' }, '');
      for (let i = 0; i < 3; i++) {
        const l = me.lanes[i];
        const box = h('div', { class: 'lane' }, h('h4', null, h('span', null, LANE_NAMES[cur.kind][i]), h('b', null, l.routed ? '溃' : l.withdrawn ? '退' : wan(l.troops))));
        box.append(meterEl(l.morale));
        const ords = h('div', { class: 'ords', style: { marginTop: '6px' } });
        for (const o of legal) {
          ords.append(h('button', { class: 'ord' + (choice.lanes[i] === o ? ' on' : ''), disabled: !laneActive(l) || cur.over || busy, 'data-lane': i, 'data-order': o, title: ORDER_HINT[o],
            onclick: () => { choice.lanes[i] = o; renderUI(); }, onmouseenter: () => { hint.textContent = `${ORDER_NAME[o]}：${ORDER_HINT[o]}`; } }, ic(ORDER_ICON[o]), ORDER_NAME[o]));
        }
        box.append(ords);
        lanes.append(box);
      }
      left.append(lanes);
      const strats = h('div', { class: 'strats' }, h('span', { class: 'lbl' }, ic('ambush'), `计策 ×${me.stratagems}`));
      strats.append(h('button', { class: 'strat' + (!choice.stratagem ? ' on' : ''), disabled: cur.over || busy, onclick: () => { choice.stratagem = undefined; renderUI(); } }, ic('close'), '不用'));
      for (const k of legalStratagems(cur, side)) {
        strats.append(h('button', { class: 'strat' + (choice.stratagem === k ? ' on' : ''), disabled: cur.over || busy, 'data-strat': k, title: STRATAGEM_HINT[k],
          onclick: () => { choice.stratagem = k as Stratagem; renderUI(); }, onmouseenter: () => { hint.textContent = `${STRATAGEM_NAME[k]}：${STRATAGEM_HINT[k]}`; } },
          ic(STRAT_ICON[k]), STRATAGEM_NAME[k], h('em', null, `${Math.round(stratagemOdds(cur, side, k) * 100)}%`)));
      }
      left.append(strats);
      const acts = h('div', { class: 'bacts' });
      if (!cur.over) {
        acts.append(
          h('button', { class: 'btn primary', id: 'battle-go', disabled: busy, onclick: () => go() }, ic('attack'), `下令 · 第 ${cur.round + 1} 回合`),
          h('button', { class: 'btn', id: 'battle-auto', disabled: busy, onclick: () => auto() }, ic('auto'), '部将代打'), hint);
      } else {
        acts.append(h('button', { class: 'btn primary', id: 'battle-done', onclick: () => done() }, ic('ok'), cur.winner === side ? '凯旋' : '收兵'));
      }
      left.append(acts);
      const logBox = h('div', { class: 'blog' });
      if (!cur.log.length) logBox.append(h('p', null, '三路各下一令，可加一条计策。'));
      for (const r of cur.log) {
        logBox.append(h('p', { class: 'r' }, `第 ${r.round} 回合`));
        for (const t of r.text) logBox.append(h('p', null, t));
      }
      if (cur.over) logBox.append(h('p', { class: 'r' }, outcomeText(cur)));
      ui.append(left, logBox);
      logBox.scrollTop = logBox.scrollHeight;
    }

    function step(c: Choice, dur: number) {
      const attC = side === 'att' ? c : aiChoice(cur, 'att');
      const defC = side === 'def' ? c : aiChoice(cur, 'def');
      const next = resolveRound(cur, attC, defC);
      anim = { from: cur, to: next, start: performance.now(), dur };
      busy = true;
      beat();
      renderUI();
      return next;
    }
    function go() {
      if (busy || cur.over) return;
      manual = true;
      step({ lanes: [...choice.lanes], stratagem: choice.stratagem }, fast ? 300 : 1500);
      choice.stratagem = undefined;
    }
    function auto() {
      if (busy || cur.over) return;
      const run = () => {
        if (cur.over) return;
        step(aiChoice(cur, side), fast ? 150 : 700);
        const wait = () => { if (busy) setTimeout(wait, 60); else if (!cur.over) run(); };
        setTimeout(wait, 60);
      };
      run();
    }
    function done() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      root.classList.add('hidden');
      clear(ui);
      resolve({ result: cur, manual });
    }
    renderUI();
    raf = requestAnimationFrame(frame);
  });
}
