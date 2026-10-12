/**
 * Inkstone — 弓使い — 造形の部品: 頭 (房の髪・顔)・胴 (革の胴着)・ケープ・矢筒・弓・線の補助
 */
import { DRAW } from '../core/settings.js';
import { TAU, V, ellipsePts, lerp } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { clipPath, fillPath, inkLine, inkShape, roughen, strokePath } from '../core/ink.js';
import { LW, lightOf, paint, paintA, shadeOf, taperPts } from '../core/paint.js';
import { cLine } from './rig.js';
import { ARC } from './archer-pose.js';

export const ARCHER_LEGS = { pants: '#5f6450', boot: '#8a5e3c', cuff: '#b48a5c', bootH: 0.5 };   // [E修正5] ズボンをくすんだ緑灰にしてブーツと分ける

// [E修正4] 髪の作り方を変更: 房を1本ずつ輪郭付きで重ねた初版は、背面が「松かさ」、正面の前髪が「顔の前の格子」に見えた。
//   起点画像の髪と同じく「1つの塊 + ぎざぎざの縁 (房の先) + 切れ込みから伸びる細い筋 + 明るい帯」で描く。
export const AH = {
  // 正面系 (sx=+1 = 画面右向き)。顔の楕円 17 × 16.5。前髪の先は眉 (y≈-2) にかからない高さ (y≤-4.4) で止める
  backF: [[-3, -20], [-13, -18], [-19, -9], [-20.5, 2], [-17.5, 9], [-12.5, 4]],
  napeF: [[-19.5, 0], [-24, 8.5], [-17.5, 5], [-18.5, 13], [-13, 6]],
  earF: [[-15, -1], [-20, 0], [-20.5, 5], [-17.5, 8], [-15, 6]],
  capF: [[17.6, -3.6], [18.2, -10], [15.5, -16], [10, -20.5], [3, -23], [-5, -23], [-11.5, -20.5],
    [-17.5, -20], [-16.5, -16], [-22, -12.5], [-18.6, -8.5], [-21.5, -3], [-17.5, -1.8], [-14.5, -5], [-11, -9],
    [-6.5, -4.8], [-3, -9], [2, -4.4], [5, -9], [10, -5], [12.5, -8.5], [16.6, -1.2]],
  capLinesF: [[[-3, -9], [-1, -17]], [[5, -9], [6.5, -16.5]], [[12.5, -8.5], [13.2, -14]], [[-16.5, -16], [-11, -19.5]], [[-18.6, -8.5], [-13.5, -13]], [[-1, -21.5], [-9, -13.5]]],
  lightF: [[-7, -20.5], [2, -21.5], [10, -18.5], [13, -14.5], [8, -16], [1, -18], [-6, -17.5]],
  ahoge: [[-1, -23], [0, -29.5], [4.8, -30.5], [2.6, -27.5], [1.6, -23]],
  // 背面系: 肌色の頭の上に髪の塊。襟足と横はぎざぎざ、顔の向く側の下に頬が少し覗く
  earBL: [[-15, -1], [-20, 0], [-20.5, 5], [-17.5, 8], [-15, 6]], earBR: [[15, -1], [20, 0], [20.5, 5], [17.5, 8], [15, 6]],
  // [E修正9] 横に房のはねを足す (滑らかな半球だと背面が「兜」に見えた)
  hairB: [[16.8, -4], [16.4, -9.5], [19, -12.5], [15, -14.5], [11.5, -19.5], [4, -23.5], [-4, -23.5], [-11.5, -19.5], [-15, -14.5], [-19, -12.5], [-16.4, -9.5], [-17.6, -4],
    [-20.5, 1.5], [-16.5, 3], [-14.5, 11], [-11, 7.5], [-7, 14.5], [-3.5, 9.5], [0.5, 15.5], [3.5, 9.5], [7.5, 14], [10, 8], [12.5, 10.5], [13.5, 3], [15.5, -1]],
  linesB: [[[-16.5, 3], [-12.5, -5]], [[-11, 7.5], [-7.5, -2]], [[-3.5, 9.5], [-1.5, 0]], [[3.5, 9.5], [3.5, 0]], [[10, 8], [8.5, -1]], [[-8, -17], [-14.5, -7]], [[8, -17.5], [13.5, -8]]],
  lightB: [[-10, -18], [-3, -21.5], [5, -21.5], [11, -18], [6, -16.5], [-1, -17.5], [-7, -16]],
};

export function drawArcherHead(ctx, c, sx, front, P) {
  const M = (arr, dx = 0) => arr.map(([x, y]) => [c.x + (x + dx) * sx, c.y + y]);
  const glow = arr => { ctx.save(); ctx.globalAlpha = 0.7; fillPath(ctx, roughen(V(M(arr)), true, 0.3, 5), ARC.hairLight); ctx.restore(); };
  if (front) {
    paintA(ctx, M(AH.backF), { fill: ARC.hairDark, w: LW.outline, depth: 2, speck: 0.6 });
    paintA(ctx, M(AH.napeF), { fill: ARC.hairDark, w: LW.part, depth: 1.5, speck: 0 });
    paintA(ctx, M(AH.earF), { fill: ARC.skin, w: LW.part, depth: 1.6, speck: 0 });
    cLine(ctx, M([[-16.5, 1.5], [-18.8, 3.4], [-17.2, 5.6]]), LW.fine);                             // 人の耳 (剣士のとがった耳と区別)
    const face = inkShape(ctx, ellipsePts(c.x, c.y, 17, 16.5, 24), { fill: ARC.skin, w: LW.outline * DRAW.lw, amp: 0.4, step: 6 });
    ctx.save(); clipPath(ctx, face);                                                                 // 前髪の影が額に落ちる
    ctx.globalAlpha = 0.4; fillPath(ctx, V(M([[-20, -18], [22, -18], [22, -1], [12, -3.5], [3, -2.8], [-7, -3.5], [-20, -1]])), shadeOf(ARC.skin, 0.22)); ctx.globalAlpha = 1;
    ctx.restore();
    paintA(ctx, M(AH.ahoge), { fill: ARC.hair, w: LW.detail, depth: 0, speck: 0, amp: 0.15 });
    paintA(ctx, M(AH.capF), { fill: ARC.hair, w: LW.outline, depth: 3, speck: 0.7 });
    glow(AH.lightF);
    for (const s of AH.capLinesF) cLine(ctx, M(s), LW.fine);
    // 顔: 楕円の目・まっすぐな短い眉・片側だけ上がる小さな口・そばかす2つずつ
    const ry = P.focus ? 1.6 : 2.75;
    for (const [ex, rx, back] of [[5, 1.85, true], [12.8, 1.6, false]]) {
      const [x, y] = M([[ex + P.look, 3.9]])[0];
      if (P.blink || (P.focus && back)) { cLine(ctx, [[x - 2.2, y + 0.3], [x + 2.2, y - 0.2]], 1.4); continue; }
      ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    }
    const bl = P.focus ? 0.9 : 0;
    cLine(ctx, M([[2.6, -1.4 + bl], [7, -2 + bl * 1.4]]), 1.3); cLine(ctx, M([[10.6, -2.1 + bl * 1.4], [14.4, -1.6 + bl]]), 1.3);
    ctx.fillStyle = shadeOf(ARC.skin, 0.38);
    for (const [fx, fy] of [[3, 7.6], [5.2, 8.4], [13.4, 8], [15.3, 7.3]]) { const [x, y] = M([[fx, fy]])[0]; ctx.beginPath(); ctx.arc(x, y, 0.65, 0, TAU); ctx.fill(); }
    if (P.mouth) { const [x, y] = M([[9.6, 10.6]])[0]; inkShape(ctx, ellipsePts(x, y, 1.9, 1.7, 12), { fill: '#7a3b2e', w: 0.9 * DRAW.lw, amp: 0.1, step: 4 }); }
    else if (P.focus) cLine(ctx, M([[8, 10.6], [11.3, 10.4]]), 1.05);
    else cLine(ctx, M([[8.2, 10.4], [10, 10.8], [11.6, 9.8]]), 1.05);
  } else {
    paintA(ctx, M(AH.earBL), { fill: ARC.skin, w: LW.part, depth: 1.4, speck: 0 }); paintA(ctx, M(AH.earBR), { fill: ARC.skin, w: LW.part, depth: 1.4, speck: 0 });
    inkShape(ctx, ellipsePts(c.x, c.y, 17, 16.5, 24), { fill: shadeOf(ARC.skin, 0.08), w: LW.outline * DRAW.lw, amp: 0.4, step: 6 });
    paintA(ctx, M(AH.ahoge), { fill: ARC.hair, w: LW.detail, depth: 0, speck: 0, amp: 0.15 });
    paintA(ctx, M(AH.hairB), { fill: ARC.hair, w: LW.outline, depth: 3.2, speck: 0.7 });
    glow(AH.lightB);
    for (const s of AH.linesB) cLine(ctx, M(s), LW.fine);
    for (const s of [[[1, -15], [-5.5, -19.5]], [[1, -15], [7.5, -19]], [[1, -15], [0.5, -9]]]) cLine(ctx, M(s), LW.fine);   // つむじからの分け目
  }
}

/** 胴: 生成りのチュニック・革の胴着 (前の留め具2つ / 背中の縫い目)・草摺・ベルトとポーチ・矢筒のベルト */
export function drawArcherTorso(ctx, rf, P) {
  const { UY, front } = rf, Q = arr => arr.map(([b, z]) => UY(0, b, z));
  paint(ctx, Q([[16, 27], [-16, 27], [-19, 16], [-12, 13.5], [-5, 16], [2, 13.5], [9, 16], [16, 13.5], [19, 16]]), { fill: ARC.linen, w: LW.outline, depth: 3, speck: 1.1 });
  paint(ctx, Q([[13.5, 47], [-13.5, 47], [-15, 34], [-16.5, 25], [16.5, 25], [15, 34]]), { fill: ARC.leather, w: LW.outline, depth: 3.6, light: 0.22, speck: 1.4 });
  dashedStroke(ctx, Q([[11.5, 45], [13, 34], [14.5, 27]])); dashedStroke(ctx, Q([[-11.5, 45], [-13, 34], [-14.5, 27]]));
  if (front) {
    pLine(ctx, Q([[1.5, 46], [1.5, 28]]), LW.detail);
    for (const z of [41, 34]) {                                                                   // 前の留め具 (革帯 + 真鍮の金具)
      paint(ctx, Q([[-3.5, z + 1.3], [6.5, z + 1.3], [6.5, z - 1.3], [-3.5, z - 1.3]]), { fill: ARC.leatherDark, w: LW.detail, depth: 0.8, speck: 0 });
      const bk = UY(0.5, 1.5, z);
      paintA(ctx, [[bk.x - 2, bk.y - 2], [bk.x + 2, bk.y - 2], [bk.x + 2, bk.y + 2], [bk.x - 2, bk.y + 2]], { fill: ARC.brass, w: LW.detail, depth: 0.6, speck: 0, light: 0.4 });
    }
  } else pLine(ctx, Q([[0, 46], [0.5, 36], [0, 28]]), LW.detail);
  paint(ctx, Q([[16.8, 28.5], [-16.8, 28.5], [-17, 24], [17, 24]]), { fill: ARC.leatherDark, w: LW.part, depth: 1.2, speck: 0.5 });
  if (front) { const bk = UY(2, 6, 26.2); paintA(ctx, [[bk.x - 2.4, bk.y - 2.8], [bk.x + 2.4, bk.y - 2.8], [bk.x + 2.4, bk.y + 2.8], [bk.x - 2.4, bk.y + 2.8]], { fill: ARC.brass, w: LW.detail, depth: 0.8, speck: 0, light: 0.4 }); }
  for (const b0 of front ? [11, -3] : [4]) paint(ctx, Q([[b0, 24], [b0 - 6.5, 24], [b0 - 6, 17], [b0 - 3.2, 15.8], [b0 - 0.5, 17]]), { fill: ARC.leather, w: LW.detail, depth: 1.4, speck: 0.6 });   // 草摺
  paint(ctx, Q([[-8.5, 27], [-15, 27], [-15.5, 19.5], [-8.5, 19.5]]), { fill: ARC.leather, w: LW.detail, depth: 1.4, speck: 0, round: 1 });   // ポーチ
  pLine(ctx, Q([[-8.5, 24.5], [-12, 23], [-15, 24.5]]), LW.fine);
  paint(ctx, Q([[-8, 47.5], [-12.5, 45], [13.5, 24.5], [17, 27]]), { fill: ARC.leatherDark, w: LW.detail, depth: 0, speck: 0 });   // 矢筒のベルト
  if (front) { const rg = UY(1, -1.5, 36.5); paint(ctx, ellipsePts(rg.x, rg.y, 2.3, 2.3, 10), { fill: ARC.brass, w: LW.detail, depth: 0.6, speck: 0, light: 0.4 }); }
}

/** 短い肩掛けケープ: 裏地が裾から覗く厚み、肩から裾への折り目、真鍮の留め具。sway で裾が揺れる */
export function drawArcherCape(ctx, rf, P) {
  const { UY, front } = rf, sw = P.capeSway;
  const Q = arr => arr.map(([b, z]) => { const k = Math.max(0, (47 - z) / 12); return UY(0, b + sw * k, z - Math.abs(sw) * 0.12 * k); });
  const hemDown = arr => arr.map(([b, z]) => [b, z - 2]);
  if (front) {
    const left = [[2.5, 51], [9, 52.5], [17, 50], [21.5, 42], [19, 36.5], [15.5, 39.5], [12, 35.5], [8, 39.5], [4.5, 37.5], [2.5, 44]];
    for (const half of [left, left.map(([b, z]) => [-b, z])]) {
      paint(ctx, Q(hemDown(half.slice(3, 9)).concat(half.slice(3, 9).reverse())), { fill: ARC.capeDark, w: LW.detail, depth: 0, speck: 0 });   // 裏地
      paint(ctx, Q(half), { fill: ARC.cape, w: LW.outline, depth: 3.2, light: 0.25, speck: 1.2 });
      const sg = half[1][0] > 0 ? 1 : -1;
      pLine(ctx, Q([[sg * 14, 49], [sg * 13, 40]]), LW.fine); pLine(ctx, Q([[sg * 7.5, 49.5], [sg * 8, 41]]), LW.fine);   // 折り目
    }
    paint(ctx, Q([[6, 53.2], [-6, 53.2], [-5, 50.5], [5, 50.5]]), { fill: ARC.capeDark, w: LW.detail, depth: 0.8, speck: 0 });   // 襟
    const cl = UY(4, 0, 49.5); paint(ctx, ellipsePts(cl.x, cl.y, 2.6, 2.5, 12), { fill: ARC.brass, w: LW.detail, depth: 0.8, speck: 0, light: 0.45 });
  } else {
    const back = [[-17, 50], [-9, 53], [9, 53], [17, 50], [21.5, 42], [18, 35], [13, 38.5], [8, 33], [3, 36.5], [0, 31.5], [-3, 36.5], [-8, 33], [-13, 38.5], [-18, 35], [-21.5, 42]];
    paint(ctx, Q(hemDown(back.slice(4)).concat(back.slice(4).reverse())), { fill: ARC.capeDark, w: LW.detail, depth: 0, speck: 0 });
    paint(ctx, Q(back), { fill: ARC.cape, w: LW.outline, depth: 3.4, light: 0.25, speck: 1.2 });
    for (const b0 of [-10, 0.5, 10]) pLine(ctx, Q([[b0 * 0.8, 51], [b0, 38]]), LW.fine);
  }
}

/** 背中の矢筒: 筒 (革の帯2本)・ケープの上から留める革帯・口の縁・矢羽 (生成り / くすんだ赤 / 緑) */
export function drawQuiver(ctx, rf, P) {
  const { UY } = rf, sw = P.quiverSway;
  const B = UY(-7, 7, 30 + sw), T = UY(-8.5, -8.5, 61 + sw);
  const dx = T.x - B.x, dy = T.y - B.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = 4;
  const at = (p, a, n) => ({ x: p.x + ux * a + nx * n, y: p.y + uy * a + ny * n });
  const arrows = [[-2.8, 8], [-0.4, 10], [2, 8.5], [3.6, 6.8]], fl = [ARC.fletch, ARC.accent, ARC.fletch2, ARC.fletch];
  for (const [o, l] of arrows) { const sh = [at(T, -6, o), at(T, l, o * 1.25)]; strokePath(ctx, sh, 2.5 * DRAW.lw, false, PAL.ink); strokePath(ctx, sh, 1.2 * DRAW.lw, false, ARC.wood); }
  paint(ctx, [at(B, 0, hw * 0.85), at(T, 0, hw), at(T, 0, -hw), at(B, 0, -hw * 0.85)], { fill: ARC.leather, w: LW.outline, depth: 2.6, light: 0.25, speck: 1 });
  for (const k of [0.2, 0.8]) { const p = { x: lerp(B.x, T.x, k), y: lerp(B.y, T.y, k) }; paint(ctx, [at(p, -1.3, hw + 0.5), at(p, 1.3, hw + 0.5), at(p, 1.3, -hw - 0.5), at(p, -1.3, -hw - 0.5)], { fill: ARC.leatherDark, w: LW.detail, depth: 0, speck: 0 }); }
  const bt = { x: lerp(B.x, T.x, 0.8), y: lerp(B.y, T.y, 0.8) };                                   // 留め具 (ベルトへつなぐ)
  paint(ctx, ellipsePts(bt.x + nx * hw * 1.2, bt.y + ny * hw * 1.2, 1.7, 1.7, 8), { fill: ARC.brass, w: LW.detail, depth: 0, speck: 0, light: 0.4 });
  const rim = []; for (let i = 0; i < 14; i++) { const th = TAU * i / 14; rim.push(at(T, Math.sin(th) * 1.8, Math.cos(th) * hw * 1.05)); }
  paint(ctx, rim, { fill: ARC.leatherDark, w: LW.part, depth: 0, speck: 0 });
  arrows.forEach(([o, l], i) => {
    for (const s of [1, -1]) inkShape(ctx, [at(T, l - 6.5, o * 1.25), at(T, l - 5, o * 1.25 + 2.8 * s), at(T, l + 0.6, o * 1.25 + 2.3 * s), at(T, l, o * 1.25)], { fill: fl[i], w: 0.9 * DRAW.lw, amp: 0.2, step: 4 });
  });
}

/** 弓: 大きく厚みのある弓 (腹側に明るい木口の筋)・握りの革巻き・角の弭 */
export function drawBow(ctx, UG, geo) {
  const N = 18, pts = [];
  for (let i = 0; i <= N; i++) pts.push(UG(...geo.pt(-1 + 2 * i / N)));
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i], q = pts[Math.min(N, i + 1)], r = pts[Math.max(0, i - 1)];
    const tx = q.x - r.x, ty = q.y - r.y, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
    const s = -1 + 2 * i / N, w = 1.6 + 3.0 * Math.pow(1 - Math.abs(s), 0.75);
    left.push({ x: p.x + nx * w / 2, y: p.y + ny * w / 2 }); right.push({ x: p.x - nx * w / 2, y: p.y - ny * w / 2 });
  }
  paint(ctx, left.concat(right.reverse()), { fill: ARC.wood, w: LW.part, depth: 1.2, speck: 0, amp: 0.15, step: 4 });
  strokePath(ctx, pts.slice(2, N - 1), 0.9 * DRAW.lw, false, lightOf(ARC.wood, 0.45), 0.95);   // 木口の筋
  const g0 = UG(...geo.pt(-0.14)), g1 = UG(...geo.pt(0.14));
  strokePath(ctx, [g0, g1], 6.2 * DRAW.lw, false, PAL.ink); strokePath(ctx, [g0, g1], 4.2 * DRAW.lw, false, ARC.grip);   // 握りの革巻き
  for (let k = 1; k < 5; k++) { const m = { x: lerp(g0.x, g1.x, k / 5), y: lerp(g0.y, g1.y, k / 5) }; strokePath(ctx, [{ x: m.x - 1.6, y: m.y - 1.2 }, { x: m.x + 1.6, y: m.y + 1.2 }], 0.6 * DRAW.lw, false, PAL.ink, 0.7); }
  for (const tp of [geo.tipT, geo.tipB]) { const q = UG(...tp); inkShape(ctx, ellipsePts(q.x, q.y, 1.7, 1.7, 8), { fill: ARC.fletch, w: 0.9 * DRAW.lw, amp: 0.1, step: 4 }); }
}

/** 画面座標の点 {x,y} 用の線 / 角の折れる線 (弦) / 縫い目の破線 */
export const pLine = (ctx, pts, w = 1.1) => inkLine(ctx, pts, { w: w * DRAW.lw, amp: 0.2, double: 0 });

export function polyStroke(ctx, pts, w, color) {
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
}

export function dashedStroke(ctx, pts, w = 0.8, dash = [2.2, 2]) {
  ctx.save(); ctx.setLineDash(dash.map(v => v * DRAW.lw)); strokePath(ctx, roughen(pts, false, 0.2, 5), w * DRAW.lw, false, ARC.leatherDark, 0.9); ctx.restore();
}

/** 前腕に直交する帯 (籠手の革帯・袖口) */
export function bandAcross(ctx, p, ux, uy, half, thick, fill) {
  const ul = Math.hypot(ux, uy) || 1, nx = -uy / ul * half, ny = ux / ul * half;
  paint(ctx, taperPts({ x: p.x - nx, y: p.y - ny }, { x: p.x + nx, y: p.y + ny }, thick, thick, 4), { fill, w: LW.detail, depth: 0.6, speck: 0 });
}
