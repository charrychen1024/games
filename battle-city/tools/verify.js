/* ===========================================================
 * Automated end-to-end verification in a real browser.
 *   node tools/verify.js [--keep]
 * Drives the game frame-by-frame through TB.debug, inspects
 * internal state, and saves screenshots to ./screenshots.
 * =========================================================== */
const path = require('path');
const fs = require('fs');
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');

const PORT = 8137;
const SHOTS = path.join(__dirname, '..', 'screenshots');
let pass = 0, fail = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else {
    fail++; failures.push(name + (detail ? ' — ' + detail : ''));
    console.log('  ✗ ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve(PORT);
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log('── boot ──');
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.TB && window.TB.game && window.TB.game.settings, null, { timeout: 8000 });
  await page.evaluate(() => {
    window.TB.debug.stepping = true;
    document.getElementById('boot').hidden = true;   // keep screenshots clean
  });
  // let any in-flight rAF frames drain before we start driving manually
  await page.waitForTimeout(150);

  check('page loads with no uncaught errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  const boot = await page.evaluate(() => ({
    sprites: !!(TB.sprites.brick && TB.sprites.eagle && TB.sprites.powerups.length === 6),
    tankDirs: TB.sprites.tank('player0', 'p1').length,
    tankFrames: TB.sprites.tank('player0', 'p1')[0].length,
    stages: TB.levels.count,
    state: TB.game.state,
    canvasW: document.getElementById('screen').width
  }));
  check('all sprite sheets generated', boot.sprites);
  check('tank sprites: 4 directions x 2 tread frames', boot.tankDirs === 4 && boot.tankFrames === 2);
  check('35 built-in stages present', boot.stages === 35, 'got ' + boot.stages);
  check('starts on the title screen', boot.state === 'title');
  check('canvas scaled to 3x (768px)', boot.canvasW === 768, 'got ' + boot.canvasW);

  // the title must actually draw something
  await page.evaluate(() => { TB.debug.step(60); TB.game.draw(document.createElement('canvas').getContext('2d')); });
  await page.screenshot({ path: path.join(SHOTS, '01-title.png') });
  const titlePixels = await page.evaluate(() => {
    const cv = document.getElementById('screen');
    const cx = cv.getContext('2d');
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    return seen.size;
  });
  check('title screen renders real pixel art', titlePixels > 8, 'distinct colours: ' + titlePixels);

  console.log('── 1 player campaign ──');
  await page.evaluate(() => { TB.debug.key('Enter', 2); });
  let st = await page.evaluate(() => TB.game.state);
  check('fire on "1 PLAYER" enters the stage intro', st === 'stageIntro', st);

  await page.screenshot({ path: path.join(SHOTS, '02-stage-intro.png') });
  await page.evaluate(() => TB.debug.step(120));
  const play = await page.evaluate(() => ({
    state: TB.game.state,
    queue: TB.game.battle.queue.length,
    players: TB.game.battle.players.filter(Boolean).length,
    lives: TB.game.session.playerState[0].lives,
    baseAlive: TB.game.battle.baseAlive,
    bricks: Array.from(TB.game.battle.grid).filter((v) => v === 1).length,
    px: TB.game.battle.players[0].x,
    py: TB.game.battle.players[0].y
  }));
  check('intro hands over to play', play.state === 'play', play.state);
  check('20 enemies queued for the stage', play.queue === 20, 'got ' + play.queue);
  check('one player tank on the field', play.players === 1);
  check('2 reserve tanks on the HUD', play.lives === 2, 'got ' + play.lives);
  check('eagle intact at stage start', play.baseAlive);
  check('stage 1 has brick terrain', play.bricks > 100, 'bricks: ' + play.bricks);
  check('player spawns at the left pad (64,192)', play.px === 64 && play.py === 192,
        `${play.px},${play.py}`);

  console.log('── movement & collision ──');
  const move = await page.evaluate(() => {
    const b = TB.game.battle, p = b.players[0];
    p.spawnTimer = 0;
    const x0 = p.x;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    TB.debug.step(20);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    const x1 = p.x;
    // drive into the right wall for a long time
    p.x = 180; p.y = 192; p.dir = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    TB.debug.step(120);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    TB.debug.step(2);
    return { x0, x1, wall: p.x, limit: TB.C.FIELD_W - 16 };
  });
  check('tank moves when a key is held', move.x1 > move.x0, `${move.x0} -> ${move.x1}`);
  check('tank cannot leave the battlefield', move.wall <= move.limit + 0.001,
        `x=${move.wall} limit=${move.limit}`);

  const snap = await page.evaluate(() => {
    const p = TB.game.battle.players[0];
    p.x = 67.4; p.y = 100.2;
    p.tryMove(0);                 // turn to face up -> x snaps to the 8px lattice
    return p.x;
  });
  check('turning snaps onto the 8px lattice', snap % 8 === 0, 'x=' + snap);

  console.log('── gunnery ──');
  const shoot = await page.evaluate(() => {
    const b = TB.game.battle, p = b.players[0];
    // park the tank under a solid brick column and fire upward
    let spot = null;
    for (let qy = 4; qy < 20 && !spot; qy++) {
      for (let qx = 2; qx < 24; qx++) {
        if (b.grid[qy * 26 + qx] === 1 && b.grid[qy * 26 + qx + 1] === 1 &&
            b.grid[(qy + 2) * 26 + qx] === 0 && b.grid[(qy + 2) * 26 + qx + 1] === 0 &&
            b.grid[(qy + 3) * 26 + qx] === 0) { spot = { qx, qy }; break; }
      }
    }
    if (!spot) return { found: false };
    p.x = spot.qx * 8; p.y = (spot.qy + 2) * 8; p.dir = 0;
    p.activeBullets = 0; p.fireCooldown = 0;
    b.bullets.length = 0;            // clear any enemy shells in flight
    const before = Array.from(b.grid).filter((v) => v === 1).length;
    p.fire();
    const fired = b.bullets.filter((bl) => bl.owner === p).length;
    TB.debug.step(30);
    const after = Array.from(b.grid).filter((v) => v === 1).length;
    return { found: true, fired, before, after, destroyed: before - after };
  });
  check('a shot spawns a bullet', shoot.found && shoot.fired === 1, JSON.stringify(shoot));
  check('bullet shatters brick in 8px pieces', shoot.destroyed >= 1 && shoot.destroyed <= 4,
        'quads destroyed: ' + shoot.destroyed);

  const steel = await page.evaluate(() => {
    const b = TB.game.battle, p = b.players[0];
    // steel resists a level-0 shot and falls to a level-3 shot
    for (let i = 0; i < 26; i++) b.grid[10 * 26 + i] = 2;
    for (let qy = 11; qy <= 13; qy++) for (let qx = 8; qx <= 14; qx++) b.grid[qy * 26 + qx] = 0;
    const baseline = Array.from(b.grid).filter((v) => v === 2).length;
    p.x = 80; p.y = 96; p.dir = 0; p.level = 0; p.applyLevel();
    p.activeBullets = 0; p.fireCooldown = 0; b.bullets.length = 0; p.fire();
    TB.debug.step(20);
    const weak = Array.from(b.grid).filter((v) => v === 2).length;
    p.level = 3; p.applyLevel();
    p.activeBullets = 0; p.fireCooldown = 0; p.x = 80; p.y = 96; p.dir = 0;
    b.bullets.length = 0; p.fire();
    TB.debug.step(20);
    const strong = Array.from(b.grid).filter((v) => v === 2).length;
    return { baseline, weak, strong };
  });
  check('steel survives a basic shot', steel.weak === steel.baseline,
        `${steel.baseline} -> ${steel.weak}`);
  check('level-3 shot breaks steel', steel.strong < steel.weak,
        `${steel.weak} -> ${steel.strong}`);

  console.log('── enemies & power-ups ──');
  const enemies = await page.evaluate(() => {
    const b = TB.game.battle;
    TB.debug.step(900);
    return {
      live: b.tanks.filter((t) => !t.isPlayer).length,
      spawned: b.spawnCursor,
      cap: b.tanks.filter((t) => !t.isPlayer).length <= TB.C.MAX_ENEMIES_ON_FIELD,
      bullets: b.bullets.length
    };
  });
  check('enemies spawn over time', enemies.spawned >= 2, 'spawned: ' + enemies.spawned);
  check('never more than 4 enemies on the field', enemies.cap,
        'live: ' + enemies.live);
  await page.screenshot({ path: path.join(SHOTS, '03-stage-01.png') });

  const pu = await page.evaluate(() => {
    const b = TB.game.battle, p = b.players[0];
    // isolate: no enemies, no shells, no new spawns — we are testing
    // the items themselves, not whether we survive long enough
    b.tanks = b.tanks.filter((t) => t.isPlayer);
    b.bullets.length = 0;
    b.spawnCursor = b.queue.length;
    p.spawnTimer = 0; p.shield = 0;
    b.dropPowerUp();
    const spawned = b.powerups.length;
    const item = b.powerups[0];
    item.kind = TB.PU.STAR;
    p.level = 0; p.applyLevel(); p.spawnTimer = 0; p.shield = 0;
    p.x = item.x; p.y = item.y;
    TB.debug.step(3);
    const lvl = p.level;
    // helmet
    b.dropPowerUp(); b.powerups[0].kind = TB.PU.HELMET;
    p.x = b.powerups[0].x; p.y = b.powerups[0].y;
    TB.debug.step(3);
    const shield = p.shield;
    // clock
    b.dropPowerUp(); b.powerups[0].kind = TB.PU.CLOCK;
    p.x = b.powerups[0].x; p.y = b.powerups[0].y;
    TB.debug.step(3);
    const freeze = b.freezeTimer;
    // shovel turns the eagle collar to steel
    b.dropPowerUp(); b.powerups[0].kind = TB.PU.SHOVEL;
    p.x = b.powerups[0].x; p.y = b.powerups[0].y;
    TB.debug.step(3);
    const collar = TB.levels.BASE_WALL_QUADS.map(([x, y]) => b.grid[y * 26 + x]);
    // extra tank
    const lives0 = TB.game.session.playerState[0].lives;
    b.dropPowerUp(); b.powerups[0].kind = TB.PU.TANK;
    p.x = b.powerups[0].x; p.y = b.powerups[0].y;
    TB.debug.step(3);
    const lives1 = TB.game.session.playerState[0].lives;
    // grenade clears the field — put some enemies back first
    b.spawnCursor = 0;
    for (let i = 0; i < 3; i++) b.spawnEnemy();
    b.tanks.forEach((t) => { if (!t.isPlayer) t.spawnTimer = 0; });
    const before = b.tanks.filter((t) => !t.isPlayer && t.spawnTimer <= 0).length;
    b.dropPowerUp(); b.powerups[0].kind = TB.PU.GRENADE;
    p.x = b.powerups[0].x; p.y = b.powerups[0].y;
    TB.debug.step(3);
    const after = b.tanks.filter((t) => !t.isPlayer && t.spawnTimer <= 0).length;
    return { spawned, lvl, shield, freeze, collar, lives0, lives1, before, after,
             score: TB.game.session.playerState[0].score };
  });
  check('power-up appears on demand', pu.spawned === 1);
  check('STAR upgrades the tank', pu.lvl === 1, 'level ' + pu.lvl);
  check('HELMET grants a shield', pu.shield > 500, 'shield ' + pu.shield);
  check('CLOCK freezes the enemies', pu.freeze > 500, 'freeze ' + pu.freeze);
  check('SHOVEL turns the eagle collar to steel', pu.collar.every((v) => v === 2),
        pu.collar.join(','));
  check('TANK awards an extra life', pu.lives1 === pu.lives0 + 1);
  check('GRENADE wipes the active enemies', pu.before >= 2 && pu.after === 0,
        `${pu.before} -> ${pu.after}`);
  check('pick-ups award points', pu.score >= 500 * 6, 'score ' + pu.score);

  console.log('── stage clear & scoring ──');
  const clear = await page.evaluate(() => {
    const b = TB.game.battle;
    b.killed = b.queue.length;
    b.spawnCursor = b.queue.length;
    b.tanks = b.tanks.filter((t) => t.isPlayer);
    const ps = TB.game.session.playerState[0];
    ps.kills = [5, 4, 3, 2];
    TB.debug.step(200);
    return { state: TB.game.state, row: TB.game.score ? TB.game.score.row : -1 };
  });
  check('clearing all 20 tanks opens the score screen', clear.state === 'score', clear.state);
  await page.evaluate(() => TB.debug.step(120));
  await page.screenshot({ path: path.join(SHOTS, '04-score.png') });
  const tallied = await page.evaluate(() => ({
    shown: TB.game.score.shown[0],
    score: TB.game.score.shownScore[0],
    done: TB.game.score.done
  }));
  check('score screen tallies every tank class', tallied.shown.join(',') === '5,4,3,2',
        tallied.shown.join(','));
  check('score screen finishes counting', tallied.done);
  check('tally pays 100/200/300/400 per class',
        tallied.score >= 5 * 100 + 4 * 200 + 3 * 300 + 2 * 400, 'score ' + tallied.score);

  const next = await page.evaluate(() => {
    TB.debug.step(200);
    return { state: TB.game.state, stage: TB.game.session.stageNum };
  });
  check('score screen advances to stage 2', next.stage === 2, 'stage ' + next.stage);
  check('next stage plays the intro', next.state === 'stageIntro' || next.state === 'play', next.state);

  console.log('── losing ──');
  const over = await page.evaluate(() => {
    TB.debug.step(120);
    const b = TB.game.battle;
    b.destroyBase();
    TB.debug.step(200);
    const s1 = TB.game.state;
    TB.debug.step(200);
    return { baseAlive: b.baseAlive, s1, s2: TB.game.state };
  });
  check('shooting the eagle destroys it', over.baseAlive === false);
  check('losing the eagle triggers GAME OVER', over.s1 === 'gameover' || over.s2 === 'score',
        `${over.s1} / ${over.s2}`);
  await page.screenshot({ path: path.join(SHOTS, '05-gameover.png') });

  const backHome = await page.evaluate(() => {
    for (let i = 0; i < 40; i++) {
      TB.debug.step(60);
      TB.debug.key('Enter', 2);
      if (TB.game.state === 'title') break;
    }
    return { state: TB.game.state, hi: TB.game.hiScore };
  });
  check('game over returns to the title screen', backHome.state === 'title', backHome.state);
  check('hi-score is kept', backHome.hi >= 20000, 'hi ' + backHome.hi);

  console.log('── two players ──');
  const two = await page.evaluate(() => {
    TB.game.menuIndex = 1;                 // 2 PLAYERS
    TB.debug.key('Enter', 2);
    TB.debug.step(140);
    const b = TB.game.battle;
    const p2 = b.players[1];
    const before = p2.frozen;
    // friendly fire should stun, not kill — clear a lane first so the
    // shot cannot be stopped by terrain on the way
    const p1 = b.players[0];
    for (let qy = 6; qy <= 7; qy++) for (let qx = 4; qx <= 20; qx++) b.grid[qy * 26 + qx] = 0;
    p1.spawnTimer = 0; p2.spawnTimer = 0; p2.shield = 0; p1.shield = 0;
    p1.x = 48; p1.y = 48; p1.dir = 1;
    p2.x = 96; p2.y = 48; p2.dir = 1;
    b.bullets.length = 0;
    p1.activeBullets = 0; p1.fireCooldown = 0; p1.fire();
    TB.debug.step(20);
    return { players: b.players.filter(Boolean).length, numPlayers: b.numPlayers,
             before, frozen: b.players[1] ? b.players[1].frozen : -1,
             alive: !!(b.players[1] && b.players[1].alive) };
  });
  check('2P mode fields two tanks', two.players === 2 && two.numPlayers === 2, JSON.stringify(two));
  check('friendly fire stuns a team-mate instead of killing', two.alive && two.frozen > 0,
        'frozen ' + two.frozen);
  await page.screenshot({ path: path.join(SHOTS, '06-two-player.png') });

  console.log('── every built-in stage loads ──');
  const allStages = await page.evaluate(() => {
    const bad = [];
    for (let n = 1; n <= TB.levels.count; n++) {
      try {
        const d = TB.levels.builtin(n);
        const v = TB.levels.validate(TB.levels.parse(d.rows));
        if (!v.ok) bad.push(n + ':' + v.reason);
        const b = new TB.Battle({
          mode: 'campaign', stageNum: n, stageLabel: '' + n, numPlayers: 1,
          playerState: [{ lives: 2, level: 0, score: 0, out: false, respawn: 0,
                          kills: [0, 0, 0, 0], totalKills: [0, 0, 0, 0], stageStartScore: 0 }],
          rows: d.rows, comp: d.comp, autoBase: true
        });
        for (let i = 0; i < 120; i++) b.update();
        if (!b.baseAlive) bad.push(n + ':base lost in 2s');
      } catch (e) { bad.push(n + ':' + e.message); }
    }
    return bad;
  });
  check('all 35 stages are valid and simulate cleanly', allStages.length === 0, allStages.join(' '));

  console.log('── survival mode ──');
  const surv = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null;
    TB.game.menuIndex = 3;
    TB.debug.key('Enter', 2);
    TB.debug.step(140);
    const ok1 = TB.game.state === 'play' && TB.game.session.mode === 'survival';
    const b = TB.game.battle;
    b.killed = b.queue.length; b.spawnCursor = b.queue.length;
    b.tanks = b.tanks.filter((t) => t.isPlayer);
    TB.debug.step(200);
    for (let i = 0; i < 30; i++) { TB.debug.step(60); if (TB.game.state === 'stageIntro') break; }
    return { ok1, stage: TB.game.session ? TB.game.session.stageNum : -1, state: TB.game.state };
  });
  check('survival mode starts', surv.ok1, surv.state);
  check('survival rolls into wave 2', surv.stage === 2, 'wave ' + surv.stage);

  console.log('── construction (level editor) ──');
  const ed = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null; TB.game.battle = null;
    TB.game.menuIndex = 4;                  // CONSTRUCTION
    TB.debug.key('Enter', 2);
    return { state: TB.game.state, hasEditor: !!TB.game.editor,
             toolbar: !document.getElementById('editor-tools').hidden,
             valid: TB.game.editor && TB.game.editor.valid.ok };
  });
  check('CONSTRUCTION opens the editor', ed.state === 'editor' && ed.hasEditor);
  check('editor shows its JSON import/export toolbar', ed.toolbar);
  check('a blank stage is immediately playable', ed.valid === true);

  // paint with the real mouse over the canvas
  const box = await page.locator('#screen').boundingBox();
  const sc = 3;
  const fieldPx = (qx, qy) => ({
    x: box.x + (8 + qx * 8 + 4) * sc,
    y: box.y + (8 + qy * 8 + 4) * sc
  });
  const target = fieldPx(6, 6);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.evaluate(() => TB.debug.step(2));
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(target.x + i * 8 * sc, target.y);
    await page.evaluate(() => TB.debug.step(2));
  }
  await page.mouse.up();
  await page.evaluate(() => TB.debug.step(2));
  const painted = await page.evaluate(() => ({
    bricks: Array.from(TB.game.editor.grid).filter((v) => v === 1).length,
    cursor: [TB.game.editor.cx, TB.game.editor.cy],
    dirty: TB.game.editor.dirty
  }));
  check('mouse drag paints terrain', painted.bricks > 8, JSON.stringify(painted));

  const edOps = await page.evaluate(() => {
    const e = TB.game.editor;
    TB.debug.key('KeyB', 2);                // brush -> 8px
    const brush8 = e.brush;
    TB.debug.key('KeyB', 2);
    const brush16 = e.brush;
    TB.debug.key('Tab', 2);                 // cycle terrain
    const terrain = e.terrain;
    TB.debug.key('Digit3', 2);              // enemy mix
    const comp = e.comp.slice();
    TB.debug.key('KeyF', 2);                // fill with current terrain
    const filled = Array.from(e.grid).filter((v) => v === e.terrain).length;
    const badNow = e.valid.ok;
    TB.debug.key('KeyC', 2);                // clear
    const cleared = Array.from(e.grid).filter((v) => v !== 0).length;
    const okNow = e.valid.ok;
    return { brush8, brush16, terrain, comp, sum: comp.reduce((a, b) => a + b, 0),
             filled, badNow, cleared, okNow };
  });
  check('B toggles the 8px / 16px brush', edOps.brush8 === 1 && edOps.brush16 === 2);
  check('TAB cycles the terrain palette', edOps.terrain === 2, 'terrain ' + edOps.terrain);
  check('enemy mix always totals 20', edOps.sum === 20, edOps.comp.join('-'));
  check('F floods the whole field', edOps.filled > 600, 'quads ' + edOps.filled);
  check('a flooded field is reported unplayable', edOps.badNow === false);
  check('C clears back to just the eagle collar', edOps.cleared === 8, 'quads ' + edOps.cleared);
  check('a cleared field is playable again', edOps.okNow === true);

  // build a small stage, save it, and play it
  const saved = await page.evaluate(() => {
    const e = TB.game.editor;
    for (let qx = 4; qx < 22; qx += 4) {
      for (let qy = 6; qy < 20; qy += 2) e.paintAt(qx, qy, 1);
    }
    e.paintAt(8, 10, 2); e.paintAt(16, 10, 3); e.paintAt(12, 14, 4); e.paintAt(20, 14, 5);
    e.revalidate();
    e.name = 'VERIFY TEST';
    e.slotIndex = -1;
    // skip the naming prompt by pre-seeding the slot
    e.slots.push(e.stageObject());
    e.slotIndex = e.slots.length - 1;
    TB.store.saveCustomStages(e.slots);
    const stored = TB.store.customStages();
    return { ok: e.valid.ok, count: stored.length, rows: stored[stored.length - 1].rows.length,
             width: stored[stored.length - 1].rows[0].length,
             comp: stored[stored.length - 1].comp };
  });
  check('hand-built stage validates as playable', saved.ok);
  check('custom stage saved to storage', saved.count >= 1, 'stages ' + saved.count);
  check('saved stage is 26x26 quad data', saved.rows === 26 && saved.width === 26,
        `${saved.rows}x${saved.width}`);
  await page.screenshot({ path: path.join(SHOTS, '07-editor.png') });

  // the real S-to-save flow, including the naming dialog
  page.once('dialog', (d) => d.accept('PROMPT SAVED'));
  const savedViaKey = await page.evaluate(async () => {
    const e = TB.game.editor;
    e.slotIndex = -1;
    e.paintAt(10, 10, 1);
    TB.debug.key('KeyS', 2);
    return { name: e.name, slot: e.slotIndex,
             stored: TB.store.customStages().map((x) => x.name) };
  });
  check('S saves through the naming dialog',
        savedViaKey.name === 'PROMPT SAVED' &&
        savedViaKey.stored.indexOf('PROMPT SAVED') >= 0, JSON.stringify(savedViaKey));

  const helpShot = await page.evaluate(() => { TB.debug.key('KeyH', 2); return TB.game.editor.showHelp; });
  check('H opens the in-editor key reference', helpShot === true);
  await page.evaluate(() => TB.debug.step(2));
  await page.screenshot({ path: path.join(SHOTS, '08-editor-help.png') });
  await page.evaluate(() => TB.debug.key('KeyH', 2));

  const testPlay = await page.evaluate(() => {
    TB.debug.key('KeyT', 2);
    const s1 = TB.game.state;
    TB.debug.step(140);
    return { s1, s2: TB.game.state, mode: TB.game.session && TB.game.session.mode,
             label: TB.game.battle && TB.game.battle.stageLabel,
             bricks: TB.game.battle ? Array.from(TB.game.battle.grid).filter((v) => v === 1).length : 0 };
  });
  check('T play-tests the stage straight from the editor',
        testPlay.s2 === 'play' && testPlay.mode === 'custom', JSON.stringify(testPlay));
  check('the play-tested stage is the one just drawn', testPlay.bricks > 20,
        'bricks ' + testPlay.bricks);
  await page.screenshot({ path: path.join(SHOTS, '09-custom-play.png') });

  console.log('── custom stage campaign ──');
  const campaign = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null;
    TB.game.menuIndex = 2;                  // CUSTOM STAGES
    TB.debug.key('Enter', 2);
    const listed = TB.game.customList.length;
    const s1 = TB.game.state;
    TB.game.customIndex = 0;                // PLAY ALL
    TB.debug.key('Enter', 2);
    TB.debug.step(140);
    return { listed, s1, s2: TB.game.state, mode: TB.game.session && TB.game.session.mode };
  });
  check('custom stage list shows saved stages', campaign.listed >= 1 && campaign.s1 === 'customSelect',
        JSON.stringify(campaign));
  check('PLAY ALL launches the custom campaign',
        campaign.s2 === 'play' && campaign.mode === 'custom', campaign.s2);

  console.log('── import / export ──');
  const io = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null;
    TB.game.menuIndex = 4;
    TB.debug.key('Enter', 2);
    const e = TB.game.editor;
    const json = e.exportJSON();
    const before = e.slots.length;
    const ok = e.importJSON(json);
    return { parses: !!JSON.parse(json).stages, before, after: e.slots.length, ok,
             rejected: e.importJSON('{not json') };
  });
  check('export produces valid JSON', io.parses);
  check('import adds the stages back', io.ok && io.after === io.before * 2,
        `${io.before} -> ${io.after}`);
  check('bad JSON is rejected without crashing', io.rejected === false);

  console.log('── pause, settings, housekeeping ──');
  const misc = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.editor = null; TB.game.session = null;
    TB.host.setEditorMode(false);
    TB.game.menuIndex = 0;
    TB.debug.key('Enter', 2);
    TB.debug.step(140);
    TB.debug.key('KeyP', 2);
    const paused = TB.game.paused;
    const x0 = TB.game.battle.players[0].x;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    TB.debug.step(40);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    const x1 = TB.game.battle.players[0].x;
    TB.debug.key('KeyP', 2);
    const resumed = !TB.game.paused;
    // settings round-trip
    TB.game.state = 'title'; TB.game.session = null; TB.game.battle = null;
    TB.game.menuIndex = 5;
    TB.debug.key('Enter', 2);
    const inSettings = TB.game.state === 'settings';
    TB.game.optIndex = 2;
    TB.debug.key('ArrowRight', 2);
    const startStage = TB.game.settings.startStage;
    const persisted = TB.store.settings().startStage;
    TB.debug.key('Escape', 2);
    return { paused, frozenWhilePaused: x0 === x1, resumed, inSettings, startStage, persisted,
             back: TB.game.state };
  });
  check('P pauses the game', misc.paused);
  check('nothing moves while paused', misc.frozenWhilePaused);
  check('P resumes', misc.resumed);
  check('SETTINGS screen opens', misc.inSettings);
  check('start stage can be changed and is persisted',
        misc.startStage === 2 && misc.persisted === 2, JSON.stringify(misc));
  check('ESC leaves settings', misc.back === 'title', misc.back);

  console.log('── a bot can actually win a stage ──');
  const bot = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null; TB.game.battle = null;
    TB.game.settings.startStage = 1;
    TB.game.menuIndex = 0;
    TB.debug.key('Enter', 2);
    TB.debug.step(120);
    const b = TB.game.battle;
    const p = b.players[0];
    p.level = 3; p.applyLevel();
    b.destroyBase = function () {};        // offence-only test: the eagle is safe
    let frames = 0;
    // hunt: face the nearest enemy, close in, keep firing
    while (TB.game.state === 'play' && frames < 7200) {
      const me = b.players[0];
      if (me) {
        me.spawnTimer = 0;
        me.shield = 120;                       // god mode: we are testing offence
        let best = null, bd = 1e9;
        for (const t of b.tanks) {
          if (t.isPlayer || !t.alive || t.spawnTimer > 0) continue;
          const dx = t.centerX() - me.centerX(), dy = t.centerY() - me.centerY();
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = t; }
        }
        if (best) {
          const dx = best.centerX() - me.centerX(), dy = best.centerY() - me.centerY();
          let dir;
          if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3;
          else dir = dy > 0 ? 2 : 0;
          const aligned = Math.abs(Math.abs(dx) > Math.abs(dy) ? dy : dx) < 10;
          if (!aligned || frames % 23 === 0) me.tryMove(dir);
          else me.tryMove(dir);
          me.fire();
        }
      }
      TB.game.update();
      TB.input.endFrame();
      frames++;
    }
    return { killed: b.killed, frames, state: TB.game.state, baseAlive: b.baseAlive };
  });
  check('a hunting bot destroys most of the wave', bot.killed >= 12,
        `killed ${bot.killed} in ${bot.frames} frames (state ${bot.state})`);
  check('stage 1 is clearable within 2 minutes', bot.killed === 20 && bot.state !== 'play',
        `killed ${bot.killed}, state ${bot.state}`);

  console.log('── soak: 5 minutes of random play ──');
  const soak = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null; TB.game.battle = null;
    TB.game.menuIndex = 0;
    TB.debug.key('Enter', 2);
    const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ'];
    const held = {};
    const states = new Set();
    const stages = new Set();
    let restarts = 0, prev = TB.game.state;
    try {
      for (let i = 0; i < 18000; i++) {
        if (i % 6 === 0) {
          const c = codes[(Math.random() * codes.length) | 0];
          const type = held[c] ? 'keyup' : 'keydown';
          window.dispatchEvent(new KeyboardEvent(type, { code: c }));
          held[c] = !held[c];
        }
        TB.game.update();
        TB.input.endFrame();
        states.add(TB.game.state);
        if (TB.game.session) stages.add(TB.game.session.stageNum);
        // count every fresh stage start — note the random key set
        // includes J, which is also "confirm", so the run restarts
        // itself as often as our own Enter does
        if (TB.game.state === 'stageIntro' && prev !== 'stageIntro') restarts++;
        prev = TB.game.state;
        if (TB.game.state === 'title' && i % 60 === 0) {
          TB.game.menuIndex = 0;          // random WASD wanders the menu
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
        }
        // random confirms can open the editor or settings — back out
        if ((TB.game.state === 'editor' || TB.game.state === 'settings' ||
             TB.game.state === 'controls' || TB.game.state === 'customSelect') &&
            i % 30 === 0) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
        }
      }
    } catch (e) {
      return { error: e.message + ' @ ' + (e.stack || '').split('\n')[1] };
    }
    return { states: Array.from(states), stages: Array.from(stages).sort((a, b) => a - b), restarts };
  });
  check('18000 frames of random play without throwing', !soak.error, soak.error);
  if (!soak.error) {
    const known = ['title', 'stageIntro', 'play', 'score', 'gameover', 'allClear',
                   'settings', 'controls', 'customSelect', 'editor'];
    check('state machine never leaves a known state',
          soak.states.every((st) => known.indexOf(st) >= 0), soak.states.join(','));
    check('soak exercises the whole play->lose->title loop',
          ['play', 'gameover', 'score', 'title'].every((st) => soak.states.indexOf(st) >= 0),
          'states: ' + soak.states.join(','));
    check('game recovers and restarts after losing', soak.restarts >= 2,
          'stage starts: ' + soak.restarts);
  }

  console.log('── performance ──');
  const perf = await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.menuIndex = 0;
    TB.debug.key('Enter', 2);
    TB.debug.step(200);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 224;
    const cx = cv.getContext('2d');
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) { TB.game.update(); TB.input.endFrame(); TB.game.draw(cx); }
    return (performance.now() - t0) / 600;
  });
  check('a full update+draw frame costs under 4ms', perf < 4, perf.toFixed(3) + 'ms/frame');

  check('still no uncaught errors after the whole run', pageErrors.length === 0,
        pageErrors.join(' | '));
  check('still no console errors after the whole run', consoleErrors.length === 0,
        consoleErrors.slice(0, 3).join(' | '));

  console.log('── the real requestAnimationFrame loop ──');
  await page.evaluate(() => {
    TB.game.state = 'title'; TB.game.session = null; TB.game.battle = null;
    TB.game.menuIndex = 0;
    TB.debug.key('Enter', 2);
    TB.debug.step(120);
    TB.debug.stepping = false;             // hand control back to rAF
    window.__t0 = TB.game.battle.tick;
    window.__s0 = TB.game.tick;
  });
  await page.waitForTimeout(2000);
  const live = await page.evaluate(() => ({
    gameFrames: TB.game.tick - window.__s0,
    battleFrames: TB.game.battle ? TB.game.battle.tick - window.__t0 : -1,
    state: TB.game.state
  }));
  check('rAF loop runs at roughly 60fps unassisted',
        live.gameFrames > 90 && live.gameFrames < 150, live.gameFrames + ' frames in 2s');
  check('the battle advances in real time', live.battleFrames > 80,
        live.battleFrames + ' battle frames');

  // drive it for real with held keys, no stepping hooks at all
  await page.evaluate(() => {
    const b = TB.game.battle;
    b.tanks = b.tanks.filter((t) => t.isPlayer);
    b.bullets.length = 0;
    b.spawnCursor = b.queue.length;        // no interruptions
    const p = b.players[0];
    p.spawnTimer = 0; p.shield = 9999;
    // park on a square that is provably clear, with room to the right
    let spot = null;
    for (let y = 0; y <= 192 && !spot; y += 8) {
      for (let x = 0; x <= 160; x += 8) {
        if (b.canPlaceTank(x, y, p) && b.canPlaceTank(x + 16, y, p)) { spot = { x, y }; break; }
      }
    }
    p.x = spot.x; p.y = spot.y; p.dir = 1;
    window.__x0 = p.x;
  });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(100);
  const realInput = await page.evaluate(() => {
    const p = TB.game.battle.players[0];
    return { x0: window.__x0, x: p ? p.x : -1, bullets: TB.game.battle.bullets.length };
  });
  check('real held keypresses drive the tank', realInput.x > realInput.x0,
        `x ${realInput.x0} -> ${realInput.x}`);
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(100);
  const realFire = await page.evaluate(() => TB.game.battle.bullets.length +
    TB.game.battle.fx.length);
  check('a real keypress fires the gun', realFire > 0, 'bullets+fx ' + realFire);

  await page.screenshot({ path: path.join(SHOTS, '10-final.png') });
  await browser.close();
  server.close();

  console.log('\n────────────────────────────────');
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFailures:'); failures.forEach((f) => console.log('  - ' + f)); }
  console.log('screenshots → screenshots/');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\nHARNESS ERROR:', e); process.exit(2); });
