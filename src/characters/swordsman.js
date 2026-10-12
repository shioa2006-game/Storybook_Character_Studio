/**
 * Inkstone — 剣士 — 緑のフード・剣 (左手)・丸盾 (右手)。左利き
 *   姿勢 (computePose) は実験B〜Eと同じ。造形は実験Eの改善版。
 */
import { seed } from '../core/random.js';
import { DRAW } from '../core/settings.js';
import { TAU, V, ellipsePts, lerp } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { clipPath, fillPath, inkLine, inkShape, roughen, strokePath } from '../core/ink.js';
import { LW, paint, paintA, shadeOf, taperPts } from '../core/paint.js';
import { KX, KY, WALK_HZ, bodyToWorld, cLine, keyframes, nrm3, renderRig, rigFrame, walkFeet } from './rig.js';
import { legParts2, mittenHand } from './painting.js';

export const ATTACK_T = 1.15;   // 攻撃1回の長さ (秒)

// 攻撃の剣: [手 a, b, z, 刃の向き a, b, z]  構え → 振りかぶり → 頭上 → 振り下ろし → 振り抜き → 戻り
export const SWING = [
  [0.00, [7, 22, 35, 0.18, 0.6, 0.78]],
  [0.28, [-4, 17, 52, -0.75, 0.2, 0.62]],
  [0.40, [4, 19, 57, 0.45, 0.05, 0.9]],
  [0.50, [17, 8, 30, 0.85, -0.25, -0.45]],
  [0.64, [15, 3, 25, 0.6, -0.45, -0.65]],
  [1.00, [7, 22, 35, 0.18, 0.6, 0.78]],
];

/** 姿勢 (すべて体の座標系) */
export function computePose(action, t) {
  const P = {
    body: [0, 0, 0], footL: [0, 6, 0], footR: [0, -6, 0],
    sword: { hand: [7, 22, 35], dir: [0.18, 0.6, 0.78] },   // 構え: 剣を体の外側へ開き、どの向きでも見えるように
    shield: { hand: [6, -24, 33] },
    mouth: 0, blink: (t % 3.1) > 2.98, trail: null, tail: 0,
  };
  if (action === 'idle') {
    const br = Math.sin(t * 2.4);                 // 呼吸
    P.body = [0, 0, br * 0.9];
    P.sword.dir = nrm3([0.18 + Math.sin(t * 1.7) * 0.05, 0.6, 0.78]);
    P.shield.hand = [6, -24, 33 + br * 0.4];
    P.tail = Math.sin(t * 1.3) * 1.2;
  } else if (action === 'walk') {
    const wf = walkFeet(t), s = wf.s;               // [実験D] 足運びは共通リグへ移設
    P.footL = wf.footL; P.footR = wf.footR;
    P.body = [2, 0, wf.bob];
    P.sword.hand = [7 - 5 * s, 22, 35 + Math.abs(s)];   // 腕は同じ側の脚と逆に振る
    P.sword.dir = nrm3([0.25 - 0.1 * s, 0.58, 0.78]);
    P.shield.hand = [6 + 4 * s, -24, 33];
    P.tail = -s * 3;
  } else {
    const u = (t % ATTACK_T) / ATTACK_T, k = keyframes(SWING, u);
    P.sword.hand = k.slice(0, 3); P.sword.dir = nrm3(k.slice(3));
    const lean = keyframes([[0, [0]], [0.28, [-2.5]], [0.5, [5]], [0.64, [5]], [1, [0]]], u)[0];
    P.body = [lean, 0, keyframes([[0, [0]], [0.28, [1.5]], [0.5, [-2]], [1, [0]]], u)[0]];
    P.footL = [keyframes([[0, [0]], [0.3, [0]], [0.5, [8]], [0.72, [8]], [1, [0]]], u)[0], 6,
      keyframes([[0, [0]], [0.32, [0]], [0.42, [4]], [0.5, [0]], [1, [0]]], u)[0]];   // 剣側の足で踏み込む
    // 振り下ろしの間は盾を胸元へ引き付ける (剣を隠しにくくする)
    P.shield.hand = keyframes([[0, [6, -24, 33]], [0.28, [8, -22, 35]], [0.5, [0, -16, 38]], [0.66, [0, -16, 38]], [1, [6, -24, 33]]], u);
    P.mouth = u > 0.38 && u < 0.66 ? 1 : 0;
    if (u > 0.42 && u < 0.7) {                   // 剣の軌跡 (振り下ろし〜振り抜き)
      const pts = [], u0 = Math.max(0.4, u - 0.16), u1 = Math.min(u, 0.64);
      for (let i = 0; i <= 8; i++) { const kk = keyframes(SWING, lerp(u0, u1, i / 8)); pts.push({ hand: kk.slice(0, 3), dir: nrm3(kk.slice(3)) }); }
      P.trail = { pts, alpha: u < 0.56 ? 1 : Math.max(0, 1 - (u - 0.56) / 0.14) };
    }
    P.tail = -lean * 0.8;
  }
  return P;
}

export const SW = {
  green: '#7ca561', greenDark: '#5c7f47', hair: '#c3925d', hairDark: '#9c6d40', skin: '#f2dcc2',
  cream: '#efe6cf', leather: '#80593a', brass: '#c9a24a', steel: '#dddbd3', iron: '#7f7d78', wood: '#a97f55', woodDark: '#7a5839',
};

export const SWORD_LEGS = { pants: '#ebe2cb', boot: '#7d5538', bootH: 0.3, footR: 3.5, soleR: 3.1 };   // [E修正10] 折り返しの帯をやめ、足を小さく (帯が浮いた輪に見え、足元が茶色の塊になった)   // [E修正2] 0.4 ではブーツが脚を覆い尽くした

// 頭部の形 (sx=+1 = 画面右向き)。顔の楕円は 17.5 × 16.5
export const SHEAD = {
  tailF: [[-15, -21], [-28, -14], [-39, -1], [-46, 11], [-36, 8], [-26, 1], [-16, -3]],
  earF: [[-16, -3], [-28.5, -10], [-25, -3.5], [-16, 5]],
  hoodF: [[19, -6], [18.5, -17], [9, -27.5], [-6, -29.5], [-18, -23.5], [-21.5, -9], [-16, -8], [-6, -13], [6, -14], [15, -11]],
  brimOut: [[-16, -8], [-6, -13], [6, -14], [15, -11], [19, -6]], brimIn: [[19.5, -2.8], [15.2, -8], [6, -11], [-6, -10], [-15.5, -5.2]],
  // [E修正11] 前髪は1つの塊 + ぎざぎざの先 (右へ流す)。房を1本ずつ輪郭付きで並べた初版は「歯」の列に見えた
  fringeF: [[-15.5, -5.2], [-14, -1.5], [-11, -5.5], [-7.5, -2.5], [-4.5, -6.5], [-0.5, -3], [2.5, -7], [7, -3.6], [9.5, -7.5], [14, -4], [16, -6.5], [19, -2.5],
    [19.5, -2.8], [15.2, -8], [6, -11], [-6, -10]],
  fringeLines: [[[-11, -5.5], [-9.5, -9]], [[-4.5, -6.5], [-3.5, -9.8]], [[2.5, -7], [3, -10.5]], [[9.5, -7.5], [9.5, -10]]],
  burnF: [[-18, -5], [-14.5, 10], [-11.5, -1]],
  hoodB: [[19, -8], [18.5, -19.5], [9, -28.5], [-8, -28.5], [-18, -20], [-19, -8], [-10, -5.5], [0, -4.5], [10, -5.5]],
  tailB: [[-5.5, -14], [6, -15], [7, 0], [2, 13], [-5, 23], [-8.5, 12], [-7.5, 0]],
  earBL: [[-15, -3], [-28, -10], [-24.5, -3], [-15, 5]], earBR: [[15, -3], [28, -10], [24.5, -3], [15, 5]],
  napeB: [[-11, -6], [-8, 4], [-5.5, -1.5], [-2, 6], [1.5, -1.5], [5, 5.5], [8, -1.5], [10.5, 3.5], [12, -6]],   // [E修正11] 襟足も1つの塊に
  cheekB: [[17.6, -1], [17.8, 6], [15.8, 9.6], [15.9, 3]],   // [E修正3・12] 頬は縁の細い三日月だけ (幅 3→1.8。髪の上の明るい泡に見えた)
};

export function drawSwordHead(ctx, c, sx, front, P) {
  const M = (arr, dx = 0) => arr.map(([x, y]) => [c.x + (x + dx) * sx, c.y + y]);
  const swingTail = (arr, k) => arr.map(([x, y], i) => [x + (i >= 2 && i <= 4 ? P.tail * k : 0), y]);
  if (front) {
    const tail = paintA(ctx, M(swingTail(SHEAD.tailF, 1)), { fill: SW.green, w: LW.outline, depth: 3.5 });
    cLine(ctx, M([[-18, -15], [-30, -5], [-38, 6]]), LW.fine);                                  // 垂れの折り目
    void tail;
    paintA(ctx, M(SHEAD.earF), { fill: SW.skin, w: LW.part, depth: 1.8, speck: 0 });
    cLine(ctx, M([[-18, -2], [-24, -6.5]]), LW.fine);
    const face = inkShape(ctx, ellipsePts(c.x, c.y, 17.5, 16.5, 24), { fill: SW.skin, w: LW.outline * DRAW.lw, amp: 0.4, step: 6 });
    ctx.save(); clipPath(ctx, face);                                                             // フードと前髪の影が額に落ちる
    ctx.globalAlpha = 0.45; fillPath(ctx, V(M([[-20, -16], [22, -16], [22, -3.5], [8, -6.5], [-6, -5], [-20, -1]])), shadeOf(SW.skin, 0.22)); ctx.globalAlpha = 1;
    ctx.restore();
    paintA(ctx, M(SHEAD.hoodF), { fill: SW.green, w: LW.outline, depth: 3.2, light: 0.25 });
    paintA(ctx, M(SHEAD.brimOut.concat(SHEAD.brimIn)), { fill: SW.greenDark, w: LW.detail, depth: 0, speck: 0.6 });   // フードの縁の厚み
    cLine(ctx, M([[-3, -27.5], [-8, -17]]), LW.fine); cLine(ctx, M([[9.5, -25], [6.5, -16.5]]), LW.fine);              // 布の折り目
    paintA(ctx, M(SHEAD.fringeF), { fill: SW.hair, w: LW.part, depth: 1.8, speck: 0, amp: 0.25, step: 4 });
    for (const l of SHEAD.fringeLines) cLine(ctx, M(l), LW.fine);
    paintA(ctx, M(SHEAD.burnF), { fill: SW.hair, w: LW.detail * 1.2, depth: 1, speck: 0, amp: 0.25 });
    // 顔: 塗りつぶしの楕円の目・短い眉・小さな口 (起点画像の原則。目のハイライトと鼻は描かない)
    ctx.fillStyle = PAL.ink;
    for (const [ex, rx] of [[5, 2.0], [13, 1.75]]) {
      const [x, y] = M([[ex, 3.6]])[0];
      if (P.blink) cLine(ctx, [[x - 2.2, y + 0.5], [x + 2.2, y + 0.5]], 1.4);
      else { ctx.beginPath(); ctx.ellipse(x, y, rx, 3.0, 0, 0, TAU); ctx.fill(); }
    }
    cLine(ctx, M([[2, -2.6], [7.2, -1.3]]), 1.5); cLine(ctx, M([[11, -1.3], [15.8, -2.6]]), 1.5);   // きりっとした眉
    if (P.mouth) { const [x, y] = M([[9.5, 10.3]])[0]; inkShape(ctx, ellipsePts(x, y, 2.1, 1.8, 12), { fill: '#7a3b2e', w: 1.0 * DRAW.lw, amp: 0.1, step: 4 }); }
    else cLine(ctx, M([[8, 10.4], [11.2, 10.2]]), 1.15);
  } else {
    paintA(ctx, M(SHEAD.earBL), { fill: SW.skin, w: LW.part, depth: 1.5, speck: 0 });
    paintA(ctx, M(SHEAD.earBR), { fill: SW.skin, w: LW.part, depth: 1.5, speck: 0 });
    const head = inkShape(ctx, ellipsePts(c.x, c.y, 17.5, 16.5, 24), { fill: SW.hair, w: LW.outline * DRAW.lw, amp: 0.4, step: 6 });
    ctx.save(); clipPath(ctx, head); fillPath(ctx, V(M(SHEAD.cheekB)), shadeOf(SW.skin, 0.12)); ctx.restore();
    paintA(ctx, M(SHEAD.napeB), { fill: SW.hair, w: LW.part, depth: 1.4, speck: 0, amp: 0.2, step: 4 });   // 襟足
    for (const l of [[[-5.5, -1.5], [-5, -5]], [[1.5, -1.5], [1.5, -5]], [[8, -1.5], [8, -5]]]) cLine(ctx, M(l), LW.fine);
    paintA(ctx, M(SHEAD.hoodB), { fill: SW.green, w: LW.outline, depth: 3.2, light: 0.25 });
    cLine(ctx, M([[0, -27], [-1.5, -15], [0, -6]]), LW.fine);                                    // 縫い目
    paintA(ctx, M(swingTail(SHEAD.tailB, 0.7), -1), { fill: SW.green, w: LW.outline, depth: 2.6 });
    cLine(ctx, M([[0, -9], [0.5, 4], [-3.5, 15]], -1), LW.fine);
  }
}

/** 剣: 刃 (樋と明るい縁)・鍔・革巻きの柄・柄頭。(hx,hy)=握り, (dx,dy)=刃の向き */
export function drawSword2(ctx, hx, hy, dx, dy, len = 36) {
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const nx = -dy, ny = dx, P = (a, b) => [hx + dx * a + nx * b, hy + dy * a + ny * b];
  paintA(ctx, [P(5, -2.7), P(len, -2.3), P(len + 8, 0), P(len, 2.3), P(5, 2.7)], { fill: SW.steel, w: LW.part, depth: 1.3, speck: 0, light: 0.35, amp: 0.2 });
  cLine(ctx, [P(7, 0.2), P(len - 3, 0.1)], LW.fine);                                              // 樋
  paintA(ctx, [P(1.6, -7.8), P(5, -7.4), P(5, 7.4), P(1.6, 7.8)], { fill: SW.brass, w: LW.part, depth: 1, speck: 0, round: 1.2, amp: 0.2 });
  paintA(ctx, [P(-8.5, -2.2), P(1.8, -2.1), P(1.8, 2.1), P(-8.5, 2.2)], { fill: SW.leather, w: LW.detail, depth: 0.8, speck: 0, amp: 0.15 });
  for (const a of [-6, -3, 0]) cLine(ctx, [P(a, -2), P(a + 1.8, 2)], LW.fine);                     // 柄の革巻き
  inkShape(ctx, ellipsePts(...P(-10, 0), 2.9, 2.9, 10), { fill: SW.brass, w: LW.detail * DRAW.lw, amp: 0.15, step: 4 });
}

/** 盾: 厚み (裏の縁)・鉄の縁と鋲・板と木目・中央の鋲。裏面は板と持ち手 */
export function drawShield2(ctx, c, h, frontSide, thick, r = 16) {
  const disk = (o) => { const pts = []; for (let i = 0; i < 26; i++) { const a = TAU * i / 26; pts.push({ x: c.x + o.x + h.x * r * Math.cos(a), y: c.y + o.y + h.y * r * Math.cos(a) - r * 1.04 * Math.sin(a) }); } return pts; };
  inkShape(ctx, disk(thick), { fill: SW.woodDark, w: LW.part * DRAW.lw, amp: 0.3, step: 6 });       // 厚み
  const outer = disk({ x: 0, y: 0 });
  if (frontSide) {
    paint(ctx, outer, { fill: SW.iron, w: LW.outline, depth: 2.4, speck: 0.8, light: 0.25 });
    const wood = paint(ctx, outer.map(p => ({ x: c.x + (p.x - c.x) * 0.8, y: c.y + (p.y - c.y) * 0.8 })), { fill: SW.wood, w: LW.detail, depth: 3, speck: 1.2 });
    ctx.save(); clipPath(ctx, wood);
    for (let k = -2; k <= 2; k++) { const o = k * r * 0.32; cLine(ctx, [[c.x + h.x * o, c.y + h.y * o - r], [c.x + h.x * o, c.y + h.y * o + r]], LW.detail); }
    for (const [k, y0] of [[-1.5, -5], [0.6, 4], [1.6, -8]]) { const o = k * r * 0.32; cLine(ctx, [[c.x + h.x * (o - 1.5), c.y + y0], [c.x + h.x * (o + 1.2), c.y + y0 + 3], [c.x + h.x * (o - 0.6), c.y + y0 + 6]], LW.fine); }   // 木目
    ctx.restore();
    ctx.fillStyle = PAL.ink;
    for (let k = 0; k < 8; k++) { const a = TAU * k / 8 + 0.3; ctx.beginPath(); ctx.arc(c.x + h.x * r * 0.9 * Math.cos(a), c.y + h.y * r * 0.9 * Math.cos(a) - r * 0.94 * Math.sin(a), 1.0, 0, TAU); ctx.fill(); }
    paint(ctx, ellipsePts(c.x, c.y, Math.max(2.2, Math.abs(h.x) * r * 0.3), r * 0.3, 14), { fill: SW.iron, w: LW.part, depth: 1.4, speck: 0, light: 0.45 });
  } else {
    paint(ctx, outer, { fill: '#8d6a47', w: LW.outline, depth: 3, speck: 1.2 });
    for (let k = -2; k <= 2; k++) { const o = k * r * 0.34; cLine(ctx, [[c.x + h.x * o, c.y + h.y * o - r * 0.92], [c.x + h.x * o, c.y + h.y * o + r * 0.92]], LW.detail); }
    paintA(ctx, [[c.x - h.x * r * 0.8, c.y - 3 - h.y * r * 0.8], [c.x + h.x * r * 0.8, c.y - 3 + h.y * r * 0.8], [c.x + h.x * r * 0.8, c.y + 2.2 + h.y * r * 0.8], [c.x - h.x * r * 0.8, c.y + 2.2 - h.y * r * 0.8]], { fill: SW.leather, w: LW.detail, depth: 1, speck: 0 });
  }
}

/** 胴: チュニック (縁の折り)・覗く下着の襟・ベルトと金具・腰のポーチ */
export function drawSwordTorso(ctx, rf, P) {
  const { U, front } = rf, Q = arr => arr.map(([b, z]) => U(0, b, z));
  // [E修正2] 裾を少し上げて脚を見せる (実験Dより z を +2.5)
  paint(ctx, Q([[15, 50], [-15, 50], [-17, 32], [-22, 19.5], [-15, 16.5], [-8, 19.5], [-1, 16.5], [6, 19.5], [13, 16.5], [22, 19.5], [17, 32]]), { fill: SW.green, w: LW.outline, depth: 4, light: 0.2, speck: 1.4 });
  pLineE(ctx, Q([[5, 26], [7.5, 18]]), LW.fine); pLineE(ctx, Q([[-7, 26], [-9, 18]]), LW.fine);   // 裾のひだ
  if (front) {
    paint(ctx, [U(3.5, -5.5, 50.5), U(3.5, 5.5, 50.5), U(4.5, 0.5, 42.5)], { fill: SW.cream, w: LW.detail, depth: 1, speck: 0 });   // 下着の襟
  } else pLineE(ctx, Q([[-1, 47], [0, 34]]), LW.fine);
  paint(ctx, Q([[17.6, 32.2], [-17.6, 32.2], [-17.9, 26.6], [17.9, 26.6]]), { fill: SW.leather, w: LW.part, depth: 1.4, speck: 0.6 });
  if (front) {
    const bk = U(4, 1, 29.4);
    paintA(ctx, [[bk.x - 3, bk.y - 3.6], [bk.x + 3, bk.y - 3.6], [bk.x + 3, bk.y + 3.4], [bk.x - 3, bk.y + 3.4]], { fill: SW.brass, w: LW.detail, depth: 1, speck: 0, light: 0.4 });
    cLine(ctx, [[bk.x - 0.2, bk.y - 2], [bk.x - 0.2, bk.y + 2]], LW.fine);
  }
  paint(ctx, [U(-0.5, -11, 27.5), U(-0.5, -16.5, 27.5), U(-0.5, -16.2, 20), U(-0.5, -11, 20.5)], { fill: SW.leather, w: LW.detail, depth: 1.2, speck: 0, round: 1 });   // ポーチ
  pLineE(ctx, [U(-0.5, -11, 25.2), U(-0.5, -13.8, 24), U(-0.5, -16.5, 25.2)], LW.fine);
}

export const pLineE = (ctx, pts, w = 1.1) => inkLine(ctx, pts, { w: w * DRAW.lw, amp: 0.2, double: 0 });

/** 袖 (肩 → 手首。太さのあるカプセル) + 生成りの袖口 + ミトン形の手。手の位置 h に装備を描くのは呼び出し側 */
export function drawArmE(ctx, s, h, fill, cuff) {
  const ux = h.x - s.x, uy = h.y - s.y, wr = { x: s.x + ux * 0.82, y: s.y + uy * 0.82 };
  paint(ctx, taperPts(s, wr, 4.4, 3.4), { fill, w: LW.part, depth: 2, speck: 1.0 });
  if (cuff) { const ul = Math.hypot(ux, uy) || 1, nx = -uy / ul * 3.6, ny = ux / ul * 3.6; paint(ctx, taperPts({ x: wr.x - nx, y: wr.y - ny }, { x: wr.x + nx, y: wr.y + ny }, 1.9, 1.9, 4), { fill: cuff, w: LW.detail, depth: 0.8, speck: 0 }); }
  return { ux, uy };
}

/**
 * 剣士を描く (実験Eの造形)。姿勢・描画順・利き手は実験Dと同じ。
 */
export function drawHeroRig(ctx, x, y, dirKey, action, t, scale = 1, opts = {}) {
  const P = computePose(action, t);
  const boil = DRAW.boil ? Math.floor(t * 5) % 3 : 0;
  const rf = rigFrame(dirKey, P.body), { dir, U, sx, front } = rf;
  const parts = [];
  parts.push(...legParts2(ctx, rf, P, SWORD_LEGS));
  parts.push({ id: 'torso', d: 0, draw: () => drawSwordTorso(ctx, rf, P) });
  const hc = U(1.5, 0, 68);
  parts.push({ id: 'head', d: 0.5, draw: () => drawSwordHead(ctx, hc, sx, front, P) });
  // 剣の腕 (左手)
  const sh = U(0, 15, 47.5), sw = P.sword, hand = U(...sw.hand);
  const tipOf = (h, d, len) => U(h[0] + d[0] * len, h[1] + d[1] * len, h[2] + d[2] * len);
  parts.push({ id: 'swordArm', d: hand.d, draw: () => {
    const a = drawArmE(ctx, sh, hand, SW.green, SW.cream);
    const tip = tipOf(sw.hand, sw.dir, 36);
    drawSword2(ctx, hand.x, hand.y, tip.x - hand.x, tip.y - hand.y, Math.max(13, Math.hypot(tip.x - hand.x, tip.y - hand.y)));
    mittenHand(ctx, hand, a.ux, a.uy, 4.3, SW.skin, { thumbSide: sx });
  } });
  const drawTrail = () => {                                                       // 剣の軌跡 (実験Dと同じ)
    if (P.trail && P.trail.alpha > 0) {
      const outer = P.trail.pts.map(q => tipOf(q.hand, q.dir, 43)), innerP = P.trail.pts.map(q => tipOf(q.hand, q.dir, 32)).reverse();
      const ribbon = roughen(outer.concat(innerP), true, 0.5, 6);
      ctx.save(); ctx.globalAlpha = 0.6 * P.trail.alpha;
      fillPath(ctx, ribbon, '#fbfaf6');
      for (let i = 1; i < outer.length - 1; i += 2) { const p = outer[i], q = innerP[innerP.length - 1 - i]; strokePath(ctx, [p, { x: lerp(p.x, q.x, 0.45), y: lerp(p.y, q.y, 0.45) }], 1.0 * DRAW.lw, false, PAL.ink, 0.5); }
      strokePath(ctx, outer, 1.1 * DRAW.lw, false, PAL.ink, 0.45);
      ctx.restore();
    }
  };
  // 盾の腕 (右手)。盾の傾きの選び方は実験Dと同じ
  const shR = U(0, -15, 47.5), shp = P.shield.hand, sHand = U(...shp);
  const cand = [[0.85, -0.5], [0.85, 0.5]].map(([na, nb]) => ({ na, nb, w: bodyToWorld(dir, na, nb) }));
  const n = cand.reduce((p, q) => Math.abs(q.w.X + q.w.Y) > Math.abs(p.w.X + p.w.Y) ? q : p);
  const frontSide = n.w.X + n.w.Y > 0;
  const hx = -n.w.Y, hy = n.w.X, hl = Math.hypot(hx, hy);
  const hAxis = { x: (hx - hy) / hl * KX, y: (hx + hy) / hl * KY };
  const thick = { x: -(n.w.X - n.w.Y) * KX * 2.8, y: -(n.w.X + n.w.Y) * KY * 2.8 };          // 盾の厚み (法線の逆向き)
  const sc = U(shp[0] + n.na * 3, shp[1] + n.nb * 3, shp[2]);
  parts.push({ id: 'shieldArm', d: sc.d, draw: () => {
    if (frontSide) { const a = drawArmE(ctx, shR, sHand, SW.green, SW.cream); mittenHand(ctx, sHand, a.ux, a.uy, 4.1, SW.skin, { knuckles: false }); drawShield2(ctx, sc, hAxis, true, thick); }
    else { drawShield2(ctx, sc, hAxis, false, thick); const a = drawArmE(ctx, shR, sHand, SW.green, SW.cream); mittenHand(ctx, sHand, a.ux, a.uy, 4.1, SW.skin); }
  } });
  renderRig(ctx, x, y, scale, parts, { prefix: 'hero', boil, shadow: opts.shadow, after: () => { seed('hero-trail'); drawTrail(); } });
  const toScreen = p => ({ x: x + p.x * scale, y: y + p.y * scale });
  return { swordHand: toScreen(hand), shieldHand: toScreen(sHand), order: parts.map(p => p.id) };
}

/**
 * 剣士のキャラクター定義 (registry に登録して使う)。
 *   コマ数は 待機16・歩行10・攻撃14 の計40コマ × 4方向 = 160コマ (実験C〜Eと同じ)。
 */
export const swordsman = Object.freeze({
  id: 'swordsman',
  label: '剣士',
  kind: 'humanoid',
  draw: drawHeroRig,
  actions: {
    idle: { period: TAU / 2.4, frames: 16 },
    walk: { period: 1 / WALK_HZ, frames: 10 },
    attack: { period: ATTACK_T, frames: 14, once: true },
  },
  frameBox: { x0: -74, x1: 74, y0: -124, y1: 20 },
  equipment: { leftHand: 'sword', rightHand: 'shield' },
});
