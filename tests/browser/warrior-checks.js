/**
 * Browser-only verification of the integration, deliberately using public APIs.
 * This checks rendering coverage and actual compositing, not artistic appeal.
 */
import { createCharacterView, createCharacterRegistry, createRenderer, frameKeysOf, validateCharacter } from '../../src/index.js';
import { warrior } from '../../game/characters/warrior.js';
import { dungeon } from '../../game/dungeon.js';

const DIRECTIONS = ['NW', 'NE', 'SW', 'SE'];
const ACTIONS = ['idle', 'walk', 'attack'];
const round = n => Math.round(n * 1000) / 1000;
// A task yield keeps controls responsive without depending on foreground RAF.
// Hidden test tabs must still finish while the demo has the browser's attention.
const yieldBrowser = () => new Promise(resolve => {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
  channel.port2.postMessage(null);
});

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function pixelBounds(canvas, originX, originY) {
  const { width, height } = canvas;
  const bytes = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let x0 = width, x1 = -1, y0 = height, y1 = -1, pixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Alpha > 2 includes fine ink while ignoring near-zero rasterization dust.
    if (bytes[(y * width + x) * 4 + 3] <= 2) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y); pixels++;
  }
  return { x0: x0 - originX, x1: x1 + 1 - originX, y0: y0 - originY, y1: y1 + 1 - originY, pixels };
}

function clearCanvas(canvas) {
  const g = canvas.getContext('2d');
  g.save(); g.resetTransform(); g.clearRect(0, 0, canvas.width, canvas.height); g.restore();
}

function appendCharacterImage(target, source, direction, action, originX, originY, box, mode) {
  if (!target) return;
  const figure = document.createElement('figure'), label = document.createElement('figcaption');
  label.textContent = `${direction} / ${action} / ${mode}`;
  const canvas = canvasOf(240, 270), g = canvas.getContext('2d');
  g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, canvas.width, canvas.height);
  const w = box.x1 - box.x0, h = box.y1 - box.y0, k = Math.min(220 / w, 246 / h);
  g.drawImage(source, originX + box.x0, originY + box.y0, w, h, (240 - w * k) / 2, (270 - h * k) / 2, w * k, h * k);
  figure.append(label, canvas); target.append(figure);
}

function appendSceneImage(target, source, text) {
  if (!target) return;
  const figure = document.createElement('figure'), label = document.createElement('figcaption');
  label.textContent = text;
  const copy = canvasOf(source.width, source.height);
  copy.getContext('2d').drawImage(source, 0, 0);
  figure.append(label, copy); target.append(figure);
}

function countChangedPixels(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) count++;
  }
  return count;
}

/** Run from warrior.html; the returned JSON is suitable for retaining with a report. */
export async function runBrowserChecks({ onProgress = () => {}, galleries = {} } = {}) {
  const started = performance.now();
  const results = {
    status: 'running', generatedAt: new Date().toISOString(),
    environment: { userAgent: navigator.userAgent, devicePixelRatio, measurementDpr: 1 },
    checks: [], character: {}, rendering: {}, limitations: [
      'Alpha bounds include the common ground shadow; translucent pixels with alpha <= 2 are ignored.',
      'FrameBox coverage samples cache keys and interval midpoints, not every possible continuous phase.',
      'RGBA values are width × height × 4 theoretical storage, not browser/GPU memory usage.',
      'Technical assertions do not determine attractive anatomy, equipment readability, or perceived foot sliding.',
      'Human subjective evaluation has not been performed.',
    ],
  };
  const check = (name, ok, details = {}) => results.checks.push({ name, pass: !!ok, ...details });
  let view, renderer;
  try {
    validateCharacter(warrior);
    const registry = createCharacterRegistry([]); registry.register(warrior);
    check('character registration and required actions', registry.get(warrior.id) === warrior && ACTIONS.every(a => warrior.actions[a]));
    check('equipment declared left sword / right shield', warrior.equipment.leftHand === 'sword' && warrior.equipment.rightHand === 'shield', { equipment: warrior.equipment });
    const box = warrior.frameBox, margin = 80;
    const width = Math.ceil(box.x1 - box.x0 + margin * 2), height = Math.ceil(box.y1 - box.y0 + margin * 2);
    const originX = margin - box.x0, originY = margin - box.y0, canvas = canvasOf(width, height);
    view = createCharacterView({ canvas, width, height, dpr: 1, scale: 1, lineScale: 1, lineBoil: true, footFix: true, registry });
    const liveRows = [], clipping = [], union = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    const boneReferences = {}, armLengthErrors = [], anatomyErrors = [];
    let maxBoneDeviation = 0;
    let liveSamples = 0;
    for (const action of ACTIONS) for (const direction of DIRECTIONS) {
      const keys = frameKeysOf(warrior.actions[action]);
      const phases = [...new Set(keys.flatMap((u, i) => [u, (u + (keys[i + 1] ?? 1)) / 2]))];
      let minimumPixels = Infinity;
      for (const phase of phases) {
        clearCanvas(canvas);
        const info = view.render({ character: warrior.id, direction, action, actionTime: phase * warrior.actions[action].period,
          originX, originY, tile: false, clear: false, projectile: false });
        if (info?.arms) {
          for (const [side, arm] of Object.entries(info.arms)) {
            const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
            const lengths = [distance(arm.S, arm.E), distance(arm.E, arm.H)];
            boneReferences[side] ??= lengths;
            const deviation = Math.max(...lengths.map((v, i) => Math.abs(v - boneReferences[side][i])));
            maxBoneDeviation = Math.max(maxBoneDeviation, deviation);
            if (deviation > .05) armLengthErrors.push({ direction, action, phase, side, lengths: lengths.map(round), deviation: round(deviation) });
          }
          if (!(info.arms.L.H[1] > 0 && info.arms.R.H[1] < 0)) anatomyErrors.push({ direction, action, phase });
        }
        const bound = pixelBounds(canvas, originX, originY);
        minimumPixels = Math.min(minimumPixels, bound.pixels); liveSamples++;
        for (const edge of ['x0', 'y0']) union[edge] = Math.min(union[edge], bound[edge]);
        for (const edge of ['x1', 'y1']) union[edge] = Math.max(union[edge], bound[edge]);
        if (bound.x0 < box.x0 || bound.x1 > box.x1 || bound.y0 < box.y0 || bound.y1 > box.y1) clipping.push({ direction, action, phase, bounds: bound });
      }
      liveRows.push({ direction, action, samples: phases.length, minimumPixels });
      check(`live nonempty ${direction}/${action}`, minimumPixels > 500, { samples: phases.length, minimumPixels });
      clearCanvas(canvas);
      view.render({ character: warrior.id, direction, action, actionTime: (action === 'attack' ? .55 : action === 'walk' ? .15 : 0) * warrior.actions[action].period,
        originX, originY, tile: false, clear: false, projectile: false });
      appendCharacterImage(galleries.live, canvas, direction, action, originX, originY, box, 'Live');
      onProgress(`Live ${direction}/${action} — ${liveSamples} samples`); await yieldBrowser();
    }
    check('all sampled Live geometry fits cached frameBox', clipping.length === 0, { samples: liveSamples, clippedSamples: clipping.length });
    check('arm bones retain their lengths across all sampled poses', Object.keys(boneReferences).length === 2 && armLengthErrors.length === 0, { maxBoneDeviation: round(maxBoneDeviation), stretchedSamples: armLengthErrors.length });
    check('sampled anatomical sword and shield hands retain their sides', Object.keys(boneReferences).length === 2 && anatomyErrors.length === 0, { wrongSideSamples: anatomyErrors.length });
    results.character = { frameBox: { ...box }, liveSamples, sampledAlphaBounds: union, clipping, liveRows, boneReferences, armLengthErrors, anatomyErrors };

    onProgress('Cached Frames: 共通キャッシュを生成'); await yieldBrowser();
    view.setMode('cached');
    let cachedSamples = 0;
    for (const action of ACTIONS) for (const direction of DIRECTIONS) {
      let minimumPixels = Infinity;
      for (const phase of frameKeysOf(warrior.actions[action])) {
        clearCanvas(canvas);
        // Tiny epsilon avoids selecting the previous key due to modulo roundoff.
        view.render({ character: warrior.id, direction, action, actionTime: phase * warrior.actions[action].period + 1e-9,
          originX, originY, tile: false, clear: false, projectile: false });
        minimumPixels = Math.min(minimumPixels, pixelBounds(canvas, originX, originY).pixels); cachedSamples++;
      }
      check(`cached nonempty ${direction}/${action}`, minimumPixels > 500, { minimumPixels });
      clearCanvas(canvas);
      view.render({ character: warrior.id, direction, action, actionTime: (action === 'attack' ? .55 : action === 'walk' ? .15 : 0) * warrior.actions[action].period + 1e-9,
        originX, originY, tile: false, clear: false, projectile: false });
      appendCharacterImage(galleries.cached, canvas, direction, action, originX, originY, box, 'Cached');
      onProgress(`Cached ${direction}/${action} — ${cachedSamples} frames`); await yieldBrowser();
    }
    const viewDiagnostics = view.getDiagnostics(), cache = viewDiagnostics.caches.characters[warrior.id];
    const expectedFrames = DIRECTIONS.length * ACTIONS.reduce((n, a) => n + frameKeysOf(warrior.actions[a]).length, 0);
    check('cache frame count covers 4 directions × all action keys', cache.frames === expectedFrames && cachedSamples === expectedFrames, { expectedFrames, generatedFrames: cache.frames });
    check('cache RGBA accounting matches actual frame dimensions', cache.bytesRGBA === cache.frames * cache.frameW * cache.frameH * 4);
    results.character.cachedSamples = cachedSamples;
    results.character.cacheScale1Dpr1 = viewDiagnostics;
    view.dispose(); view = null;

    onProgress('8×8 scene: 前後関係とピクセル遮蔽'); await yieldBrowser();
    const sceneCanvas = canvasOf(960, 680), g = sceneCanvas.getContext('2d');
    renderer = createRenderer({ canvas: sceneCanvas, width: 960, height: 680, dpr: 1, characterScale: 1.25,
      room: dungeon, characters: [], mode: 'live', lineBoil: false, footFix: true, xray: false });
    renderer.registerCharacter(warrior);
    renderer.fitToRoom({ margin: 26, maxScale: 1.1 });
    check('room dimensions are 8 × 8', renderer.room.W === 8 && renderer.room.D === 8);
    const columns = dungeon.objects.filter(o => o.type === 'column');
    const counts = Object.fromEntries(['column', 'chest', 'crate', 'barrel'].map(type => [type, dungeon.objects.filter(o => o.type === type).length]));
    check('required room objects and architecture', counts.column === 2 && counts.chest === 1 && counts.crate >= 1 && counts.barrel >= 1 && dungeon.doors.length >= 1 && dungeon.torches.length >= 1, { counts });
    let maxRoundtripError = 0;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const p = renderer.worldToScreen(x + .5, y + .5), q = renderer.screenToWorld(p.x, p.y);
      maxRoundtripError = Math.max(maxRoundtripError, Math.abs(q.x - (x + .5)), Math.abs(q.y - (y + .5)));
    }
    check('64 tile centers round-trip through camera', maxRoundtripError < 1e-10, { maxRoundtripError });
    const capture = () => g.getImageData(0, 0, sceneCanvas.width, sceneCanvas.height).data;
    const snapshot = units => { const info = renderer.render({ timeSeconds: 0, units }); return { info, pixels: capture() }; };
    const depthRows = [];
    for (const [i, column] of columns.entries()) {
      const colName = column.label || '石柱', cx = column.cell[0] + .5 + (column.at?.[0] || 0), cy = column.cell[1] + .5 + (column.at?.[1] || 0);
      const pair = {};
      for (const [where, offset] of [['behind', -.8], ['front', .8]]) {
        const unit = { id: 'verification-warrior', character: warrior.id, x: cx + offset, y: cy + offset, direction: 'SE', action: 'idle', actionTime: 0 };
        renderer.setOptions({ xray: false });
        const base = snapshot([]), withUnit = snapshot([unit]);
        const order = withUnit.info.order, warriorIndex = order.indexOf(unit.id), columnIndex = order.indexOf(colName);
        check(`column ${i + 1} ${where}: depth order`, warriorIndex >= 0 && columnIndex >= 0 && (where === 'behind' ? warriorIndex < columnIndex : warriorIndex > columnIndex), { order });
        if (i === 0) appendSceneImage(galleries.scene, sceneCanvas, where === 'behind' ? '石柱の後ろ（透視OFF）' : '石柱の手前（透視OFF）');
        const visiblePixels = countChangedPixels(base.pixels, withUnit.pixels);
        renderer.setOptions({ xray: true });
        const xray = renderer.render({ timeSeconds: 0, units: [unit] });
        if (where === 'behind') check(`column ${i + 1} behind: xray candidate detected`, xray.occluded.includes(unit.id), { occluded: xray.occluded });
        renderer.setOptions({ xray: false });
        renderer.setRoom({ ...dungeon, objects: dungeon.objects.filter(o => o !== column) });
        const withoutColumnBase = snapshot([]), withoutColumnUnit = snapshot([unit]);
        const unobstructedPixels = countChangedPixels(withoutColumnBase.pixels, withoutColumnUnit.pixels);
        renderer.setRoom(dungeon);
        pair[where] = { unit: { x: unit.x, y: unit.y }, order, xrayCandidates: [...xray.occluded], visiblePixels, unobstructedPixels, lostPixels: unobstructedPixels - visiblePixels };
      }
      check(`column ${i + 1} behind: actual pixels are obscured`, pair.behind.lostPixels > 30, pair.behind);
      // The foreground character must retain substantially more of its pixels.
      const backRatio = pair.behind.visiblePixels / Math.max(1, pair.behind.unobstructedPixels);
      const frontRatio = pair.front.visiblePixels / Math.max(1, pair.front.unobstructedPixels);
      check(`column ${i + 1}: foreground remains visible`, frontRatio > .85 && frontRatio > backRatio + .03, { frontRatio: round(frontRatio), backRatio: round(backRatio) });
      depthRows.push({ column: colName, ...pair });
      onProgress(`石柱 ${i + 1}/${columns.length} — 前後・遮蔽確認`); await yieldBrowser();
    }
    const propDepthRows = [];
    for (const prop of dungeon.objects.filter(o => o.type !== 'column')) {
      for (const [where, offset] of [['behind', -.8], ['front', .8]]) {
        const unit = { id: 'verification-warrior', character: warrior.id, x: prop.cell[0] + .5 + offset,
          y: prop.cell[1] + .5 + offset, direction: 'SW', action: 'idle', actionTime: 0 };
        const { order } = renderer.render({ timeSeconds: 0, units: [unit] });
        const warriorIndex = order.indexOf(unit.id), propIndex = order.indexOf(prop.label);
        check(`${prop.type} ${where}: depth order`, warriorIndex >= 0 && propIndex >= 0 && (where === 'behind' ? warriorIndex < propIndex : warriorIndex > propIndex), { order });
        propDepthRows.push({ prop: prop.label, where, order });
      }
    }
    renderer.setMode('cached');
    const sceneCaches = renderer.prepareCaches([warrior.id]);
    const sceneInfo = renderer.render({ timeSeconds: 0, units: [{ id: 'verification-warrior', character: warrior.id, x: 4.5, y: 4.5, direction: 'SW', action: 'attack', actionTime: .55 * warrior.actions.attack.period }] });
    check('cached scene renders warrior without warnings', sceneInfo.warnings.length === 0 && sceneInfo.order.includes('verification-warrior'));
    results.rendering = { depthRows, propDepthRows, rendererCachePreparation: sceneCaches, diagnostics: renderer.getDiagnostics() };
    renderer.dispose(); renderer = null;
  } catch (error) {
    check('verification completed without exception', false, { error: String(error), stack: error.stack });
  } finally {
    view?.dispose(); renderer?.dispose();
  }
  results.elapsedMs = round(performance.now() - started);
  results.passed = results.checks.filter(c => c.pass).length;
  results.failed = results.checks.filter(c => !c.pass).length;
  results.status = results.failed ? 'failed' : 'passed';
  return results;
}

const runButton = document.getElementById('run');
if (runButton) {
  let resultDownloadUrl;
  runButton.addEventListener('click', async () => {
    const status = document.getElementById('status'), output = document.getElementById('results');
    const download = document.getElementById('download-results');
    download.hidden = true;
    if (resultDownloadUrl) URL.revokeObjectURL(resultDownloadUrl);
    runButton.disabled = true;
    const galleries = { live: document.getElementById('live-gallery'), cached: document.getElementById('cached-gallery'), scene: document.getElementById('scene-gallery') };
    Object.values(galleries).forEach(el => el.replaceChildren());
    output.textContent = JSON.stringify({ status: 'running' });
    try {
      const result = await runBrowserChecks({ galleries, onProgress: text => { status.textContent = text; } });
      output.textContent = JSON.stringify(result, null, 2);
      resultDownloadUrl = URL.createObjectURL(new Blob([output.textContent], { type: 'application/json' }));
      download.href = resultDownloadUrl; download.hidden = false;
      output.dataset.status = result.status;
      status.textContent = `${result.status.toUpperCase()} · ${result.passed} passed / ${result.failed} failed · ${round(result.elapsedMs / 1000)}s`;
    } catch (error) {
      status.textContent = 'FAILED'; output.textContent = JSON.stringify({ status: 'failed', error: String(error), stack: error.stack }, null, 2);
    } finally { runButton.disabled = false; }
  });
}
