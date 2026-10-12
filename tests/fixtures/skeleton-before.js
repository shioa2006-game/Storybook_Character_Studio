/**
 * Inkstone — 骸骨 — 共通人体リグを使わない「一枚絵」型のキャラクター (向きは左右反転 mirror だけ)
 *   ink_dungeon / 実験A〜E と同じ描画。小さな剣 drawSword は実験Dの剣士ファイルから移した (骸骨だけが使う)。
 */
import { seed } from '../../src/core/random.js';
import { DRAW } from '../../src/core/settings.js';
import { TAU, V, ellipsePts } from '../../src/core/geometry.js';
import { PAL } from '../../src/core/palette.js';
import { clipPath, fillPoly, inkLine, inkShape, roughen, strokePath } from '../../src/core/ink.js';
import { cEllipse, cLine, cShape, shadeSide } from '../../src/characters/rig.js';

/** 小さな剣 (元の drawSword と同形): (hx,hy)=握り, (dx,dy)=刃の向き, len=刃の長さ */
export function drawSword(ctx, hx, hy, dx, dy, len = 32) {
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const nx = -dy, ny = dx, P = (a, b) => [hx + dx * a + nx * b, hy + dy * a + ny * b];
  cShape(ctx, [P(4, -2.4), P(len, -2.2), P(len + 7, 0), P(len, 2.2), P(4, 2.4)], '#e4e2dc', 1.6);
  cLine(ctx, [P(6, 0), P(len, 0)], 0.7);
  ctx.save(); ctx.globalAlpha = 0.5; fillPoly(ctx, V([P(len * 0.45, 0), P(len, 0.2), P(len, 2), P(len * 0.45, 2.2)]), '#b9b7b0'); ctx.restore();
  cShape(ctx, [P(2, -7), P(5, -7), P(5, 7), P(2, 7)], PAL.leather, 1.5);
  cShape(ctx, [P(-7, -1.8), P(2, -1.8), P(2, 1.8), P(-7, 1.8)], PAL.woodDark, 1.3);
  cEllipse(ctx, ...P(-8.5, 0), 2.6, 2.6, PAL.iron, 1.3);
}

/** 骨: カプセル + 両端のこぶ */
export function bone(ctx, x1, y1, x2, y2, r = 2.2) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * r, ny = dx / L * r;
  cShape(ctx, [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], PAL.bone, 1.5, 0.3);
  for (const [x, y] of [[x1, y1], [x2, y2]]) cEllipse(ctx, x, y, r * 1.35, r * 1.25, PAL.bone, 1.4);
}

/** 肋骨などの「線状の骨」: 黒い太線の上に骨色の細線 */
export function boneStroke(ctx, arr, w = 2.4) {
  const p = roughen(V(arr), false, 0.3, 5);
  strokePath(ctx, p, w + 2.4, false, PAL.ink); strokePath(ctx, p, w, false, PAL.bone);
}

/** 丸盾: 木の板 + 鉄の縁 + 中央の鋲 */
export function drawRoundShield(ctx, cx, cy, rx, ry) {
  const outer = cEllipse(ctx, cx, cy, rx, ry, PAL.iron, 1.9);
  const inner = inkShape(ctx, ellipsePts(cx, cy, rx * 0.8, ry * 0.8, 22), { fill: PAL.wood, w: 1.2, amp: 0.35, step: 6 });
  ctx.save(); clipPath(ctx, inner);
  for (let k = -2; k <= 2; k++) inkLine(ctx, V([[cx + k * rx * 0.32, cy - ry], [cx + k * rx * 0.32 + 1, cy + ry]]), { w: 0.8, amp: 0.3, double: 0 });
  ctx.restore();
  shadeSide(ctx, outer, cx + rx * 0.15, { alpha: 0.45, gap: 2.6 });
  ctx.fillStyle = PAL.ink; // 縁の鋲
  for (let k = 0; k < 8; k++) { const a = TAU * k / 8 + 0.3; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9, 0.9, 0, TAU); ctx.fill(); }
  cEllipse(ctx, cx, cy, rx * 0.28, ry * 0.28, PAL.ironLight, 1.4);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - rx * 0.08, cy - ry * 0.1, 1, 0, TAU); ctx.fill();
}

/**
 * 骸骨: 大きな頭蓋骨、肋骨、細い手足、丸盾と小さな剣。左(主人公の方向)を向く。
 */
export function drawSkeleton(ctx, x, y, t = 0, scale = 1) {
  const boil = DRAW.boil ? Math.floor(t * 5) % 3 : 0;
  seed('skel' + boil);
  const bob = Math.sin(t * 3.1 + 1.3) * 1.4, jaw = Math.max(0, Math.sin(t * 4.2)) * 1.2;
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  // 脚 (奥 → 手前)
  bone(ctx, 5, -22, 9, -11); bone(ctx, 9, -11, 8, -3, 1.9);
  cShape(ctx, [[2, -4], [10, -4], [10, 0.5], [0, 0.5]], PAL.bone, 1.5);
  bone(ctx, -4, -22, -8, -11); bone(ctx, -8, -11, -9, -3, 1.9);
  cShape(ctx, [[-15, -4], [-6, -4], [-6, 0.5], [-16, 0.5]], PAL.bone, 1.5);
  ctx.translate(0, bob * 0.6);
  // 骨盤
  const pel = cShape(ctx, [[-10, -27], [10, -27], [9, -20], [3, -18], [0, -21], [-3, -18], [-9, -20]], PAL.bone, 1.6);
  ctx.fillStyle = PAL.ink; for (const hx of [-5, 5]) { ctx.beginPath(); ctx.ellipse(hx, -22.5, 1.8, 1.3, 0, 0, TAU); ctx.fill(); }
  void pel;
  // 背骨
  for (let k = 0; k < 4; k++) cShape(ctx, [[-2.2, -30 - k * 4.2], [2.2, -30 - k * 4.2], [2.2, -27 - k * 4.2], [-2.2, -27 - k * 4.2]], PAL.bone, 1.2);
  // 盾を持つ腕 (奥側の上腕)
  bone(ctx, 10, -46, 14, -37, 1.9);
  // 肋骨
  for (let k = 0; k < 4; k++) {
    const yy = -45 + k * 4.3, s = 1 - k * 0.1;
    boneStroke(ctx, [[1, yy], [6 * s, yy - 1], [11 * s, yy + 1.5], [9 * s, yy + 3.6]], 2.1);
    boneStroke(ctx, [[-1, yy], [-6 * s, yy - 1], [-11 * s, yy + 1.5], [-9 * s, yy + 3.6]], 2.1);
  }
  boneStroke(ctx, [[0, -47], [0, -33]], 2.4);                                                      // 胸骨
  boneStroke(ctx, [[-12, -47], [0, -48.5], [12, -47]], 2.6);                                       // 鎖骨
  // 剣の腕 (手前の左腕を振り上げる)
  ctx.save(); ctx.translate(-24, -49); ctx.rotate(Math.sin(t * 3.1) * 0.05);
  drawSword(ctx, 0, 0, -0.62, -1, 31);
  ctx.restore();
  bone(ctx, -11, -46, -19, -39, 1.9); bone(ctx, -19, -39, -24, -48, 1.7);
  cEllipse(ctx, -24, -49, 3.4, 3.2, PAL.bone, 1.4);
  // 頭蓋骨
  ctx.translate(0, bob * 0.3);
  const skull = cEllipse(ctx, 1, -65, 16, 15, PAL.bone, 2.0);
  shadeSide(ctx, skull, 8, { alpha: 0.4, gap: 2.5 });
  const jawS = cShape(ctx, [[-11, -57 + jaw], [6, -57 + jaw], [7, -50 + jaw], [-2, -47 + jaw], [-10, -49 + jaw]], PAL.bone, 1.8);
  shadeSide(ctx, jawS, 3, { alpha: 0.35 });
  inkLine(ctx, V([[-10, -53.5 + jaw], [5, -53.5 + jaw]]), { w: 1.0, amp: 0.2, double: 0 });         // 歯
  for (let k = 0; k < 5; k++) inkLine(ctx, V([[-8 + k * 3, -56 + jaw], [-8 + k * 3, -51 + jaw]]), { w: 0.8, amp: 0.1, double: 0 });
  // 眼窩・鼻
  cEllipse(ctx, -6, -65, 4.4, 5, PAL.ink, 1.2);
  cEllipse(ctx, 5.5, -65, 3.7, 4.7, PAL.ink, 1.2);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -66, 0.9, 0, TAU); ctx.fill();
  cShape(ctx, [[-2.6, -59.5], [0.4, -59.5], [-1.1, -56.5]], PAL.ink, 1.0);
  inkLine(ctx, V([[6, -79], [3, -75], [6, -72.5]]), { w: 0.9, amp: 0.2, double: 0 });               // ひび
  // 盾 (右前)
  drawRoundShield(ctx, 13, -31, 12, 13.5);
  ctx.restore();
}

/**
 * 骸骨のキャラクター定義。待機1種類 (16コマ、向きなし)。左右の向きは unit.mirror で反転する。
 *   コマの選び方は実験C〜Eと同じ「位相 × コマ数 の切り捨て」(index: 'floor')。
 */
export const skeleton = Object.freeze({
  id: 'skeleton',
  label: '骸骨',
  kind: 'sprite',
  directional: false,
  draw: (ctx, x, y, direction, action, t, scale) => drawSkeleton(ctx, x, y, t, scale),
  actions: { idle: { period: TAU / 3.1, frames: 16, index: 'floor' } },
  frameBox: { x0: -52, x1: 52, y0: -100, y1: 14 },
});
