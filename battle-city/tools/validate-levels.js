/* Automated stage validation: geometry, enemy mix, and reachability.
 * Run: node tools/validate-levels.js
 */
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {}, fillStyle: '' }) })
};

const root = path.join(__dirname, '..');
for (const f of ['js/core.js', 'js/levels.js']) {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(root, f), 'utf8'));
}

const TB = global.TB;
const C = TB.C, L = TB.levels;
let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warnings++; console.log('  ! ' + m); };

/* hard = terrain as-is; soft = bricks count as passable, because a
 * tank can always shoot its way through them. Playability is judged
 * on the soft graph, which is what the arcade levels assume. */
function solidAt(grid, qx, qy, soft) {
  if (qx < 0 || qy < 0 || qx >= C.COLS || qy >= C.ROWS) return true;
  const v = grid[qy * C.COLS + qx];
  if (soft && v === TB.T.BRICK) return false;
  return TB.BLOCKS_TANK[v];
}
/* a tank is 16x16 at pixel (8i, 8j) -> covers quads i..i+1, j..j+1 */
function freeNode(grid, i, j, soft) {
  if (i < 0 || j < 0 || i > C.COLS - 2 || j > C.ROWS - 2) return false;
  return !solidAt(grid, i, j, soft) && !solidAt(grid, i + 1, j, soft) &&
         !solidAt(grid, i, j + 1, soft) && !solidAt(grid, i + 1, j + 1, soft);
}
function bfs(grid, si, sj, soft) {
  const N = C.COLS, seen = new Uint8Array(N * N);
  if (!freeNode(grid, si, sj, soft)) return seen;
  const q = [si * N + sj];
  seen[si * N + sj] = 1;
  while (q.length) {
    const cur = q.pop();
    const i = (cur / N) | 0, j = cur % N;
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
    for (const [ni, nj] of nb) {
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const k = ni * N + nj;
      if (seen[k] || !freeNode(grid, ni, nj, soft)) continue;
      seen[k] = 1; q.push(k);
    }
  }
  return seen;
}

/* can a tank standing on a reachable node touch the eagle's collar? */
function reachesBase(seen) {
  const N = C.COLS;
  for (const [wx, wy] of L.BASE_WALL_QUADS.concat(L.BASE_QUADS)) {
    for (let i = wx - 2; i <= wx + 1; i++) {
      for (let j = wy - 2; j <= wy + 1; j++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        if (seen[i * N + j]) return true;
      }
    }
  }
  return false;
}

console.log('── stage geometry & reachability ──');
for (let n = 1; n <= L.count; n++) {
  const { rows, comp } = L.builtin(n);
  const label = 'STAGE ' + String(n).padStart(2, '0');
  const bad = [];
  rows.forEach((r, i) => { if (r.length !== 13) bad.push(`row ${i} len=${r.length}`); });
  if (rows.length !== 13) bad.push(`rowcount=${rows.length}`);
  if (bad.length) err(`${label}: ${bad.join(', ')}`);

  const sum = comp.reduce((a, b) => a + b, 0);
  if (sum !== C.ENEMIES_PER_STAGE) err(`${label}: enemy mix sums to ${sum}, expected ${C.ENEMIES_PER_STAGE}`);

  const q = L.buildQueue(comp);
  if (q.length !== 20) err(`${label}: queue length ${q.length}`);
  const counted = [0, 0, 0, 0];
  q.forEach((t) => counted[t]++);
  for (let t = 0; t < 4; t++) {
    if (counted[t] !== comp[t]) err(`${label}: queue has ${counted[t]} of type ${t}, expected ${comp[t]}`);
  }

  const grid = L.parse(rows);
  // player spawns usable with no digging at all
  for (const [cx, cy] of L.PLAYER_SPAWN_CELLS) {
    if (!freeNode(grid, cx * 2, cy * 2, false)) err(`${label}: player spawn (${cx},${cy}) blocked`);
  }
  // every enemy spawn must be able to fight its way to the base,
  // and each player must be able to leave their pad
  for (const [cx, cy] of L.ENEMY_SPAWN_CELLS) {
    if (!freeNode(grid, cx * 2, cy * 2, false)) { err(`${label}: enemy spawn (${cx},${cy}) blocked`); continue; }
    const soft = bfs(grid, cx * 2, cy * 2, true);
    if (!reachesBase(soft)) err(`${label}: enemy spawn (${cx},${cy}) cannot reach the base even through brick`);
    for (const [px, py] of L.PLAYER_SPAWN_CELLS) {
      if (!soft[(px * 2) * C.COLS + (py * 2)]) {
        err(`${label}: enemy spawn (${cx},${cy}) is cut off from player spawn (${px},${py})`);
      }
    }
  }
  for (const [px, py] of L.PLAYER_SPAWN_CELLS) {
    const soft = bfs(grid, px * 2, py * 2, true);
    if (!reachesBase(soft)) err(`${label}: player spawn (${px},${py}) cannot get back to the base`);
    let open = 0;
    for (let k = 0; k < soft.length; k++) open += soft[k];
    if (open < 40) warn(`${label}: player spawn (${px},${py}) has only ${open} reachable squares`);
  }
  // the base must not be walled in by indestructible steel only
  const bq = L.BASE_WALL_QUADS.map(([x, y]) => grid[y * C.COLS + x]);
  if (bq.some((v) => v !== TB.T.BRICK)) err(`${label}: eagle collar is not brick`);
}

console.log('── generated survival stages ──');
for (let n = 1; n <= 30; n++) {
  const { rows, comp } = L.randomStage(n);
  rows.forEach((r, i) => { if (r.length !== 13) err(`SURVIVAL ${n}: row ${i} len=${r.length}`); });
  const sum = comp.reduce((a, b) => a + b, 0);
  if (sum !== 20) err(`SURVIVAL ${n}: mix sums to ${sum}`);
}

console.log('');
console.log(errors === 0
  ? `PASS — ${L.count} stages valid (${warnings} warning${warnings === 1 ? '' : 's'})`
  : `FAIL — ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors === 0 ? 0 : 1);
