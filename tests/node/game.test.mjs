import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, findPath } from '../../game/game.js';
import { bindControls } from '../../game/controls.js';
import { dungeon, START_CELL } from '../../game/dungeon.js';
import { walkSecondsPerTile } from '../../src/index.js';
import { catalog } from '../../characters/catalog.js';

const advance = (game, seconds, step = 1 / 60) => {
  for (let left = seconds; left > 1e-9; left -= step) game.update(Math.min(left, step));
};
const centre = (game, cell) => {
  assert.deepEqual(game.cell, cell);
  assert.equal(game.unit.x, cell[0] + 0.5);
  assert.equal(game.unit.y, cell[1] + 0.5);
};

test('catalog characters use their own attack duration and only supported actions', () => {
  for (const entry of catalog) {
    const game = createGame({ character: entry.definition });
    assert.equal(game.unit.character, entry.id);
    if (entry.definition.actions.attack) {
      assert.equal(game.attack(), true);
      const period = entry.definition.actions.attack.period;
      advance(game, period - .01);
      assert.equal(game.unit.action, 'attack');
      advance(game, .02);
      assert.equal(game.unit.action, 'idle');
    } else {
      assert.equal(game.attack(), false);
      assert.equal(game.unit.action, 'idle');
    }
  }
});

test('switching during movement or attack clears the state and stays on a walkable centre', () => {
  const game = createGame({ character: catalog.find(c => c.id === 'warrior').definition });
  game.moveTo(7, 5); advance(game, .2); game.attack();
  game.setCharacter(catalog.find(c => c.id === 'archer').definition);
  centre(game, START_CELL);
  assert.equal(game.queuedAttack, false); assert.deepEqual(game.path, []);
  assert.equal(game.unit.action, 'idle'); assert.equal(game.unit.actionTime, 0);
  game.attack(); advance(game, .2);
  game.setCharacter(catalog.find(c => c.id === 'swordsman').definition);
  centre(game, START_CELL); assert.equal(game.unit.action, 'idle');
  assert.equal(game.unit.character, 'swordsman');
});

test('idle-only skeleton moves without inventing walk or attack, including queued input', () => {
  const game = createGame({ character: catalog.find(c => c.id === 'skeleton').definition });
  assert.ok(game.moveTo(7, 5)); advance(game, .2);
  const route = game.path;
  assert.equal(game.unit.action, 'idle'); assert.equal(game.attack(), false);
  assert.deepEqual(game.path, route); assert.equal(game.queuedAttack, false);
  advance(game, 3); centre(game, [7, 5]);
  assert.equal(game.unit.action, 'idle'); assert.deepEqual(game.path, []);
});

test('8×8 room has two columns and all required props; every free cell is reachable', () => {
  assert.equal(dungeon.width, 8); assert.equal(dungeon.depth, 8);
  assert.equal(dungeon.objects.filter(p => p.type === 'column').length, 2);
  for (const type of ['chest', 'crate', 'barrel']) assert.ok(dungeon.objects.some(p => p.type === type));
  assert.ok(dungeon.doors.length && dungeon.torches.length);
  const game = createGame();
  let free = 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    if (!game.isWalkable(i, j)) { assert.equal(findPath(dungeon, START_CELL, [i, j]), null); continue; }
    free++;
    let previous = START_CELL;
    const path = findPath(dungeon, START_CELL, [i, j]);
    assert.ok(path);
    for (const next of path) {
      assert.ok(game.isWalkable(...next));
      assert.equal(Math.abs(next[0] - previous[0]) + Math.abs(next[1] - previous[1]), 1);
      previous = next;
    }
    assert.deepEqual(previous, [i, j]);
  }
  assert.equal(free, 59);
});

test('BFS takes the shortest available detour and returns null for an isolated target', () => {
  const room = { width: 3, depth: 3, objects: [{ cell: [1, 1] }] };
  assert.equal(findPath(room, [0, 1], [2, 1]).length, 4);
  const sealed = { width: 3, depth: 3, objects: [{ cell: [1, 0] }, { cell: [1, 1] }, { cell: [1, 2] }] };
  assert.equal(findPath(sealed, [0, 1], [2, 1]), null);
  assert.equal(findPath(room, [0, 0], [-1, 0]), null);
  assert.equal(findPath(room, [0, 0], [0.3, 1]), null);
});

test('click route visits centres, avoids occupied cells and settles in idle', () => {
  const game = createGame();
  assert.ok(game.moveTo(6, 0));
  const route = game.path;
  for (const cell of route) assert.ok(game.isWalkable(...cell));
  for (let n = 0; n < 1000 && game.unit.action !== 'idle'; n++) {
    game.update(1 / 60);
    assert.ok(game.isWalkable(Math.floor(game.unit.x), Math.floor(game.unit.y)));
  }
  centre(game, [6, 0]);
  assert.equal(game.unit.action, 'idle');
  assert.deepEqual(game.path, []); assert.equal(game.target, null);
  assert.ok(Math.abs(game.snapshot().totalWalked - route.length) < 1e-9);
});

test('all four direction mappings and blocked edge movement are correct', () => {
  const moves = { NE: [4, 4], NW: [3, 5], SW: [4, 6], SE: [5, 5] };
  for (const [direction, destination] of Object.entries(moves)) {
    const game = createGame();
    assert.ok(game.moveDirection(direction));
    assert.equal(game.unit.direction, direction);
    advance(game, 1); centre(game, destination); assert.equal(game.unit.action, 'idle');
  }
  const edge = createGame({ startCell: [0, 0] });
  assert.equal(edge.moveDirection('NW'), false); centre(edge, [0, 0]);
  assert.equal(edge.moveDirection('NE'), false); centre(edge, [0, 0]);
  assert.equal(edge.moveDirection('invalid'), false);
  const obstacle = createGame({ startCell: [1, 2] });
  assert.equal(obstacle.moveDirection('SE'), false); centre(obstacle, [1, 2]);
});

test('walk animation phase is distance based and independent of update frequency', () => {
  const a = createGame(), b = createGame();
  a.moveTo(7, 5); b.moveTo(7, 5);
  advance(a, 0.4, 1 / 120); advance(b, 0.4, 0.1);
  assert.ok(Math.abs(a.unit.x - b.unit.x) < 1e-9);
  assert.ok(Math.abs(a.unit.actionTime - 0.4 * 1.5 * walkSecondsPerTile(1.25)) < 1e-9);
  assert.ok(Math.abs(a.unit.actionTime - b.unit.actionTime) < 1e-9);
});

test('retargeting preserves the active cell segment; turns occur at centres', () => {
  const game = createGame();
  game.moveTo(7, 5); advance(game, 0.2);
  const before = { ...game.unit };
  game.moveTo(5, 6);
  assert.equal(game.unit.x, before.x); assert.equal(game.unit.y, before.y);
  assert.deepEqual(game.path, [[5, 5], [5, 6]]);
  assert.equal(game.unit.direction, 'SE');
  advance(game, 0.5);
  assert.equal(game.unit.direction, 'SW');
  assert.equal(game.unit.x, 5.5);
  advance(game, 2); centre(game, [5, 6]); assert.equal(game.unit.action, 'idle');
});

test('an attack requested while moving finishes one segment, clears route, then returns idle', () => {
  const game = createGame({ attackPeriod: 1.32 });
  game.moveTo(7, 5); advance(game, 0.2);
  assert.ok(game.attack()); assert.ok(game.queuedAttack);
  assert.equal(game.moveDirection('NW'), false);
  assert.equal(game.attack(), false);
  assert.deepEqual(game.path, [[5, 5]]);
  advance(game, 0.6); centre(game, [5, 5]);
  assert.equal(game.unit.action, 'attack'); assert.equal(game.unit.direction, 'SE');
  assert.equal(game.moveTo(4, 5), false);
  advance(game, 1.32); centre(game, [5, 5]);
  assert.equal(game.unit.action, 'idle'); assert.equal(game.queuedAttack, false);
  assert.deepEqual(game.path, []);
});

test('reset clears an attack and movement state; invalid time and long stalls cannot teleport', () => {
  const game = createGame();
  game.moveTo(7, 7); game.update(50);
  assert.ok(game.snapshot().totalWalked <= 0.375 + 1e-9);
  const state = game.snapshot();
  game.update(NaN); game.update(-1);
  assert.deepEqual(game.snapshot(), state);
  game.attack(); game.reset(); centre(game, START_CELL);
  assert.equal(game.unit.action, 'idle'); assert.equal(game.unit.actionTime, 0);
  assert.equal(game.queuedAttack, false); assert.deepEqual(game.path, []);
});

test('input bindings use documented keys, suppress repeats and restore input after blur', () => {
  const win = new EventTarget(), canvas = new EventTarget();
  canvas.ownerDocument = { defaultView: win };
  canvas.hasAttribute = () => false; canvas.focus = () => {};
  let enabled = true;
  const moves = [], clicks = [];
  let attacks = 0;
  const game = { moveDirection: dir => moves.push(dir), moveTo: (...cell) => clicks.push(cell), attack: () => attacks++ };
  const control = bindControls(canvas, { eventToWorld: event => ({ x: event.clientX, y: event.clientY }) }, game, { isEnabled: () => enabled });
  const key = (code, type = 'keydown', repeat = false) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, repeat }); win.dispatchEvent(event);
  };
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { key(code); key(code, 'keyup'); }
  assert.deepEqual(moves, ['NE', 'NW', 'SW', 'SE']);
  key('Space'); key('Space', 'keydown', true); assert.equal(attacks, 1);
  win.dispatchEvent(new Event('blur')); key('Space'); assert.equal(attacks, 2);
  enabled = false; key('KeyW'); assert.equal(moves.length, 4);
  enabled = true;
  const event = new Event('pointerdown'); Object.assign(event, { button: 0, clientX: 3.9, clientY: 4.8 });
  canvas.dispatchEvent(event); assert.deepEqual(clicks, [[3, 4]]);
  control.dispose(); key('KeyA'); assert.equal(moves.length, 4);
});
