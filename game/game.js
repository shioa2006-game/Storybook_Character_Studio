import { DIRECTIONS, walkSecondsPerTile, validateCharacter } from '../src/index.js';
import { CHARACTER_SCALE, START_CELL, dungeon } from './dungeon.js';

const cellKey = (i, j) => `${i},${j}`;
const sameCell = (a, b) => a[0] === b[0] && a[1] === b[1];
const validCell = cell => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger);

function navigation(room) {
  const width = room.width ?? room.W, depth = room.depth ?? room.D;
  if (!Number.isInteger(width) || !Number.isInteger(depth) || width < 1 || depth < 1) {
    throw new Error('Game: room width and depth must be positive integers');
  }
  // A prop owns its complete cell; visual footprints remain Inkstone's concern.
  const blocked = new Set((room.objects || []).filter(o => o.blocking !== false).map(o => cellKey(...o.cell)));
  const isWalkable = (i, j) => Number.isInteger(i) && Number.isInteger(j)
    && i >= 0 && i < width && j >= 0 && j < depth && !blocked.has(cellKey(i, j));

  function path(from, to) {
    if (!validCell(from) || !validCell(to) || !isWalkable(...from) || !isWalkable(...to)) return null;
    if (sameCell(from, to)) return [];
    const queue = [from.slice()], previous = new Map([[cellKey(...from), null]]);
    for (let head = 0; head < queue.length; head++) {
      const here = queue[head];
      for (const { vector: [dx, dy] } of Object.values(DIRECTIONS)) {
        const next = [here[0] + dx, here[1] + dy], key = cellKey(...next);
        if (!isWalkable(...next) || previous.has(key)) continue;
        previous.set(key, here);
        if (sameCell(next, to)) {
          const result = [];
          for (let at = next; !sameCell(at, from); at = previous.get(cellKey(...at))) result.push(at.slice());
          return result.reverse();
        }
        queue.push(next);
      }
    }
    return null;
  }
  return { width, depth, blocked, isWalkable, path };
}

/** Four-neighbour shortest route, excluding from and including to; null if unreachable. */
export function findPath(room, from, to) { return navigation(room).path(from, to); }

/** Game state only: Inkstone owns projection, poses, scene ordering, and drawing. */
export function createGame({
  room = dungeon,
  characterScale = CHARACTER_SCALE,
  attackPeriod = 1.3,
  speed = 1.5,
  startCell = START_CELL,
  character = null,
} = {}) {
  const nav = navigation(room), walkTimePerTile = walkSecondsPerTile(characterScale);
  if (!validCell(startCell) || !nav.isWalkable(...startCell)) throw new Error('Game: start cell must be walkable');
  if (!(Number.isFinite(speed) && speed > 0 && Number.isFinite(attackPeriod) && attackPeriod > 0
    && Number.isFinite(characterScale) && characterScale > 0)) throw new Error('Game: speed, attackPeriod and characterScale must be positive');

  const unit = { id: 'warrior', character: 'warrior', x: 0, y: 0, direction: 'SW', action: 'idle', actionTime: 0 };
  let canWalk = true, canAttack = true;
  let currentCell, route, segment, target, attackQueued, walked, totalWalked, status;

  function idle(message = '待機中') {
    unit.action = 'idle'; unit.actionTime = 0;
    target = null; status = message;
  }

  function beginAttack() {
    route = []; target = null; attackQueued = false;
    unit.action = 'attack'; unit.actionTime = 0; status = '攻撃中';
  }

  function nextSegment() {
    if (attackQueued) { beginAttack(); return; }
    if (!route.length) { idle(); return; }
    const next = route.shift(), dx = next[0] - currentCell[0], dy = next[1] - currentCell[1];
    if (Math.abs(dx) + Math.abs(dy) !== 1 || !nav.isWalkable(...next)) {
      route = []; idle('経路を停止しました'); return;
    }
    segment = { from: currentCell.slice(), to: next, progress: 0 };
    unit.direction = dx < 0 ? 'NW' : dx > 0 ? 'SE' : dy < 0 ? 'NE' : 'SW';
    if (unit.action !== 'walk') walked = 0;
    unit.action = canWalk ? 'walk' : 'idle';
    unit.actionTime = canWalk ? walked * walkTimePerTile : 0;
    status = canWalk ? '移動中' : '移動中（待機姿勢）';
  }

  function moveTo(i, j) {
    if (unit.action === 'attack' || attackQueued) { status = '攻撃が終わるまで構えを保持'; return false; }
    if (!nav.isWalkable(i, j)) { status = '壁や障害物のマスへは移動できません'; return false; }
    // Retarget only at the next centre: never cut a corner across an occupied cell.
    const anchor = segment ? segment.to : currentCell;
    const nextRoute = nav.path(anchor, [i, j]);
    if (nextRoute === null) { status = 'そこへ到達できる経路がありません'; return false; }
    route = nextRoute; target = [i, j];
    if (!segment) {
      if (!route.length) idle('現在のマスです');
      else nextSegment();
    } else status = '次のマスから経路を変更';
    return true;
  }

  function moveDirection(direction) {
    const dir = DIRECTIONS[direction];
    if (!dir) return false;
    if (unit.action === 'attack' || attackQueued) { status = '攻撃が終わるまで構えを保持'; return false; }
    const anchor = segment ? segment.to : currentCell;
    // At rest, blocked movement still lets the player face that direction to attack.
    if (!segment) unit.direction = direction;
    const [dx, dy] = dir.vector;
    return moveTo(anchor[0] + dx, anchor[1] + dy);
  }

  function attack() {
    if (!canAttack) return false;
    if (unit.action === 'attack' || attackQueued) return false;
    route = []; target = null;
    if (segment) { attackQueued = true; status = '次のマスで攻撃'; }
    else beginAttack();
    return true;
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Do not teleport after a background-tab stall; normal frames conserve their time.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9) {
      if (unit.action === 'attack') {
        const spent = Math.min(remaining, Math.max(0, attackPeriod - unit.actionTime));
        unit.actionTime += spent; remaining -= spent;
        if (unit.actionTime >= attackPeriod - 1e-9) idle();
        else break;
      } else if (segment) {
        const distance = Math.min(1 - segment.progress, remaining * speed);
        segment.progress += distance; walked += distance; totalWalked += distance;
        remaining -= distance / speed;
        unit.x = segment.from[0] + 0.5 + (segment.to[0] - segment.from[0]) * segment.progress;
        unit.y = segment.from[1] + 0.5 + (segment.to[1] - segment.from[1]) * segment.progress;
        if (canWalk) unit.actionTime = walked * walkTimePerTile;
        else unit.actionTime += distance / speed;
        if (segment.progress >= 1 - 1e-9) {
          currentCell = segment.to.slice(); segment = null;
          unit.x = currentCell[0] + 0.5; unit.y = currentCell[1] + 0.5;
          nextSegment();
        } else break;
      } else {
        unit.actionTime += remaining; break;
      }
    }
  }

  function reset() {
    currentCell = startCell.slice(); route = []; segment = null; target = null;
    attackQueued = false; walked = 0; totalWalked = 0;
    unit.x = currentCell[0] + 0.5; unit.y = currentCell[1] + 0.5; unit.direction = 'SW';
    idle();
  }

  // Switch at the last reached cell centre. Never carry an unfinished attack,
  // queued input, or fractional position into another character's animation.
  function setCharacter(definition) {
    validateCharacter(definition);
    unit.character = definition.id;
    canWalk = !!definition.actions.walk;
    canAttack = !!definition.actions.attack;
    attackPeriod = definition.actions.attack?.period ?? 1.3;
    route = []; segment = null; attackQueued = false; walked = 0;
    unit.x = currentCell[0] + .5; unit.y = currentCell[1] + .5;
    idle();
  }

  const api = {
    unit, update, moveTo, moveDirection, attack, reset, setCharacter,
    isWalkable: nav.isWalkable,
    get path() { return [...(segment ? [segment.to.slice()] : []), ...route.map(p => p.slice())]; },
    get cell() { return currentCell.slice(); },
    get target() { return target?.slice() ?? null; },
    get queuedAttack() { return attackQueued; },
    get status() { return status; },
    snapshot() {
      return {
        unit: { ...unit }, cell: api.cell, path: api.path, target: api.target,
        status, queuedAttack: attackQueued, totalWalked, walkTimePerTile, speed, attackPeriod,
        segment: segment ? { from: segment.from.slice(), to: segment.to.slice(), progress: segment.progress } : null,
        blocked: [...nav.blocked].map(key => key.split(',').map(Number)),
      };
    },
  };
  reset();
  if (character) setCharacter(character);
  return api;
}
