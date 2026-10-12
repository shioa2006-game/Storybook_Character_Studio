import { createRenderer } from '../src/index.js';
import { catalog, findCharacter } from '../characters/catalog.js';
import { dungeon, CHARACTER_SCALE } from './dungeon.js';
import { createGame } from './game.js';
import { bindControls } from './controls.js';

const $ = id => document.getElementById(id);
const canvas = $('dungeon');
const requested = new URL(location.href).searchParams.get('character');
let selected = findCharacter(requested) || findCharacter('warrior') || catalog[0];
const renderer = createRenderer({ canvas, width: 960, height: 600, characters: [], characterScale: CHARACTER_SCALE, xray: false, lineBoil: true, footFix: true });
for (const entry of catalog) renderer.registerCharacter(entry.definition);
renderer.setRoom(dungeon);
renderer.fitToRoom({ margin: 24, maxScale: 1.1 });
const game = createGame({ room: dungeon, characterScale: CHARACTER_SCALE, character: selected.definition });
let mode = 'live', hover = null, last = null, sceneTime = 0, resizeTimer, request = 0, raf = 0, disposed = false;
const errors = [];
function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  errors.push(message); $('app-message').textContent = `表示エラー: ${message}`;
}
window.addEventListener('error', e => showError(e.error || e.message));
window.addEventListener('unhandledrejection', e => showError(e.reason));
const controls = bindControls(canvas, renderer, game, { onHover: cell => { hover = cell; } });

for (const entry of catalog) {
  const option = document.createElement('option');
  option.value = entry.id; option.textContent = entry.name;
  $('character-select').append(option);
}
function updateCharacter() {
  $('character-select').value = selected.id;
  $('character-name').textContent = selected.name;
  $('character-category').textContent = selected.category;
  $('character-description').textContent = selected.description;
  $('gallery-detail').href = `../index.html#character/${encodeURIComponent(selected.id)}`;
  const labels = { idle: '待機', walk: '歩行', attack: '攻撃' };
  const notes = [`${selected.directions.length ? '4方向' : '方向なし'} / ${selected.actions.map(a => labels[a] || a).join('・')}`];
  if (!selected.actions.includes('walk')) notes.push('歩行アニメーションは未対応です。待機姿勢のまま移動します。');
  if (!selected.actions.includes('attack')) notes.push('攻撃は未対応です。Spaceは無効です。');
  $('capability-note').textContent = notes.map(note => note.replace(/。$/, '')).join('。') + '。';
  $('attack').disabled = !selected.actions.includes('attack');
  $('attack').textContent = $('attack').disabled ? '攻撃は未対応' : '攻撃する（Space）';
  canvas.setAttribute('aria-label', `8×8ダンジョンの${selected.name}。床クリックまたはWASDで移動。${$('attack').disabled ? '攻撃は未対応。' : 'Spaceで攻撃。'}`);
  const url = new URL(location.href); url.searchParams.set('character', selected.id);
  history.replaceState(null, '', url);
}
$('character-select').addEventListener('change', e => {
  const entry = findCharacter(e.target.value);
  if (!entry) return;
  request++; controls.clear(); hover = null;
  game.setCharacter(entry.definition); selected = entry;
  renderer.disposeCaches(); $('app-message').textContent = '';
  updateCharacter(); render(0); updateDiagnostics();
});
$('reset').addEventListener('click', () => { controls.clear(); game.reset(); canvas.focus({ preventScroll: true }); });
$('xray').addEventListener('change', e => renderer.setOptions({ xray: e.target.checked }));
for (const button of document.querySelectorAll('[data-move]')) button.addEventListener('click', () => {
  game.moveDirection(button.dataset.move); canvas.focus({ preventScroll: true });
});
$('attack').addEventListener('click', () => { game.attack(); canvas.focus({ preventScroll: true }); });
async function setMode(value) {
  const token = ++request;
  $('app-message').textContent = value === 'cached' ? `${selected.name}のキャッシュを準備しています…` : '';
  await new Promise(resolve => setTimeout(resolve, 0));
  if (disposed || token !== request) return;
  if (value === 'cached') renderer.prepareCaches([selected.id]);
  else renderer.disposeCaches();
  mode = value; renderer.setMode(mode);
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  $('app-message').textContent = ''; updateDiagnostics();
}
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode).catch(showError));

function resize() {
  if (disposed) return;
  const wrap = document.querySelector('.dungeon-canvas-wrap');
  const width = Math.round(wrap.clientWidth), height = Math.round(wrap.clientHeight), dpr = Math.min(2, devicePixelRatio || 1);
  const camera = renderer.getCamera();
  if (width && height && (camera.width !== width || camera.height !== height || camera.dpr !== dpr)) renderer.resize(width, height, dpr);
}
const observer = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });
observer.observe(document.querySelector('.dungeon-canvas-wrap'));
document.addEventListener('visibilitychange', () => { last = null; controls.clear(); });
function render(dt) {
  game.update(dt);
  renderer.render({ timeSeconds: sceneTime, units: [game.unit], floorOverlay: (ctx, api) => {
    for (const [i, j] of game.path) api.dot(i + .5, j + .5, 3, 1.8, '#986352');
    if (game.target) api.dashedCell(...game.target, '#874d3f', 1.4);
    if (hover && game.isWalkable(...hover)) api.dashedCell(...hover, '#7b8161', 1.4);
  }});
  $('game-state').textContent = `${game.status}${selected.directions.length ? ' · ' + game.unit.direction : ''}${game.queuedAttack ? ' / 攻撃待ち' : ''}`;
  $('position').textContent = `マス ${game.cell[0] + 1} / ${game.cell[1] + 1}`;
}
function snapshot() { return { character: selected.id, mode, game: game.snapshot(), renderer: renderer.getDiagnostics(), errors: [...errors] }; }
function updateDiagnostics() { if ($('diagnostics').open) $('diagnostic-output').textContent = JSON.stringify(snapshot(), null, 2); }
$('refresh-diagnostics').addEventListener('click', updateDiagnostics);
$('diagnostics').addEventListener('toggle', updateDiagnostics);
function tick(now) {
  if (disposed) return;
  const dt = last === null || document.hidden ? 0 : Math.min((now - last) / 1000, .05); last = now; sceneTime += dt;
  try { if (!document.hidden) render(dt); } catch (error) { showError(error); return; }
  raf = requestAnimationFrame(tick);
}
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; request++; cancelAnimationFrame(raf); clearTimeout(resizeTimer); observer.disconnect(); controls.dispose(); renderer.dispose();
});
updateCharacter(); resize(); render(0); raf = requestAnimationFrame(tick);
