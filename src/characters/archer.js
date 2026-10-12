/**
 * Inkstone — 弓使い — 組み立て (共通リグ + 部品 + 描画順の補正) とキャラクター定義
 *   左手 = 弓、右手 = 弦と矢、矢筒 = 背中。
 *   描画順の補正: 胸の前の右手は a+10 / 前腕は肘と手が別の層なら分割 / 弦の上半分は頭の直前まで。
 */
import { DRAW } from '../core/settings.js';
import { lerp } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { strokePath } from '../core/ink.js';
import { LW, paint, taperPts } from '../core/paint.js';
import { DIRS, KX, KY_G, LAYER, WALK_HZ, bodyLayerKey, bodyToWorld, cLine, groundDirScreen, ik2, nrm3, renderRig, rigFrame, vlerp, yawToBody } from './rig.js';
import { legParts2, mittenHand } from './painting.js';
import { AIM_YAW, ARC, ARCHER_ATTACK_T, ARCHER_IDLE_PERIOD, ARCHER_RELEASE_U, ARROW_LEN, archerPose, bowCantSign, bowGeometry, drawArrowShape } from './archer-pose.js';
import { ARCHER_LEGS, bandAcross, drawArcherCape, drawArcherHead, drawArcherTorso, drawBow, drawQuiver, polyStroke } from './archer-parts.js';

/**
 * 弓使いを描く (実験Eの造形)。(x,y)=足元の画面座標。姿勢・描画順の決め方は実験Dと同じ。
 * @returns 手・弦・矢の画面座標 (確認表示用)
 */
export function drawArcherRig(ctx, x, y, dirKey, action, t, scale = 1, opts = {}) {
  const P = archerPose(action, t);
  const boil = DRAW.boil ? Math.floor(t * 5) % 3 : 0;
  const rf = rigFrame(dirKey, P.body, P.yaw), { dir, U, sx, front } = rf;
  const UG = (a, b, z) => { const w = bodyToWorld(dir, a + P.body[0], b + P.body[1]); return { x: (w.X - w.Y) * KX, y: (w.X + w.Y) * KY_G() - (z + P.body[2]), d: w.X + w.Y }; };
  const key = (p, eps = 0) => bodyLayerKey(rf, p[0], p[1], p[2]) + eps;
  // [方向ごとの補正] 弓の上端を頭から離す傾き。[E] 弓が大きくなったので傾きを増やす (D: 0.1 + 0.24·k)
  P.bowUp = nrm3([P.bowUp[0], P.bowUp[1] + bowCantSign(dirKey) * (0.12 + 0.62 * (P.yaw / AIM_YAW)), P.bowUp[2]]);
  const geo = bowGeometry(P), parts = [];
  parts.push(...legParts2(ctx, rf, P, ARCHER_LEGS));
  parts.push({ id: 'torso', d: LAYER.torso, draw: () => drawArcherTorso(ctx, rf, P) });
  parts.push({ id: 'cape', d: LAYER.cape, draw: () => drawArcherCape(ctx, rf, P) });
  const hc = U(1.5, 0, 67);
  parts.push({ id: 'head', d: LAYER.head, draw: () => drawArcherHead(ctx, hc, sx, front, P) });
  const qa = yawToBody(rf, -8.5, -8.5);
  parts.push({ id: 'quiver', d: key([qa[0], qa[1], 61]), draw: () => drawQuiver(ctx, rf, P) });
  const fb = [-2, -16, 71], ft = [-9, -19.5, 90];                                 // 羽根飾り (右耳の後ろ)
  parts.push({ id: 'feather', d: key(fb), draw: () => {
    const a = U(...fb), b = U(...ft), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    paint(ctx, [a, { x: a.x + dx * 0.45 + nx * 3.4, y: a.y + dy * 0.45 + ny * 3.4 }, b, { x: a.x + dx * 0.5 - nx * 2.6, y: a.y + dy * 0.5 - ny * 2.6 }], { fill: ARC.fletch2, w: LW.detail, depth: 1, speck: 0, amp: 0.2, step: 4 });
    cLine(ctx, [[a.x, a.y], [b.x, b.y]], LW.fine);
  } });
  // 腕: 肩 → 肘 (IK) → 手。[E] 上腕・前腕を太さのある先細りの形にし、手をミトン形に
  const arm = (side) => {
    const sb = side === 'L' ? 14 : -14, sa = yawToBody(rf, 0, sb), S = [sa[0], sa[1], 47];
    const H = side === 'L' ? P.grip : P.rHand, E = ik2(S, H, 11.5, 11.5, side === 'L' ? P.elbowL : P.elbowR);
    const S2 = vlerp(S, E, 0.3);
    parts.push({ id: 'upper' + side, d: key(E), draw: () => paint(ctx, taperPts(U(...S2), U(...E), 4.8, 4.1), { fill: ARC.linen, w: LW.part, depth: 1.8, speck: 0.9 }) });
    const Hk = side === 'R' && H[0] > -2 ? [H[0] + 10, H[1], H[2]] : H;           // [D修正3・5] 胸の前の右手は「胸と顎より前」
    // [E修正7] 前腕の分割: 肘と手が別の層 (胴の奥 / 胴と頭の間 / 頭の手前) にあるときは、肘側の半分を肘の順位で、手側の半分を手の順位で描く。
    //   1つの部品のままだと、↙↘ の引き切りで「体の後ろの肘 → 胸の前の手」の前腕全体が顎の前に描かれ、白い棒が口元に立って見えた。
    const layerOf = k => Math.round(k / 1000), split = layerOf(key(E)) !== layerOf(key(Hk));
    const fore = (half) => {
      const e = U(...E), h = UG(...H), ux = h.x - e.x, uy = h.y - e.y, wr = { x: e.x + ux * 0.8, y: e.y + uy * 0.8 };
      const m = { x: lerp(e.x, wr.x, 0.5), y: lerp(e.y, wr.y, 0.5) }, seg = half === 'e' ? [e, m] : half === 'h' ? [m, wr] : [e, wr];
      const r0 = side === 'L' ? 4.4 : 4.3, r1 = side === 'L' ? 4.0 : 3.6, rm = (r0 + r1) / 2;
      const rr = half === 'e' ? [r0, rm] : half === 'h' ? [rm, r1] : [r0, r1];
      if (side === 'L') {                                                         // 弓手: 革の籠手 (帯2本) + 弓を握る手
        paint(ctx, taperPts(seg[0], seg[1], rr[0], rr[1]), { fill: ARC.leatherDark, w: LW.part, depth: 1.6, speck: 0.8, light: 0.2 });
        if (half !== 'h') bandAcross(ctx, { x: lerp(e.x, wr.x, 0.35), y: lerp(e.y, wr.y, 0.35) }, ux, uy, 4.7, 1.1, ARC.leather);
        if (half === 'e') return;
        bandAcross(ctx, { x: lerp(e.x, wr.x, 0.8), y: lerp(e.y, wr.y, 0.8) }, ux, uy, 4.4, 1.1, ARC.leather);
        mittenHand(ctx, h, ux, uy, 4.1, ARC.skin, { thumbSide: -sx });
      } else {                                                                    // 弦を引く手: 生成りの袖 + 革の手袋
        paint(ctx, taperPts(seg[0], seg[1], rr[0], rr[1]), { fill: ARC.linen, w: LW.part, depth: 1.6, speck: 0.9 });
        if (half === 'e') return;
        bandAcross(ctx, wr, ux, uy, 3.9, 1.5, ARC.leather);
        mittenHand(ctx, h, ux, uy, 3.9, ARC.leatherDark, { knuckles: false, thumbSide: sx });
      }
    };
    if (split) {
      parts.push({ id: 'foreE' + side, d: key(E, 0.01), draw: () => fore('e') });
      parts.push({ id: 'fore' + side, d: key(Hk), draw: () => fore('h') });
    } else parts.push({ id: 'fore' + side, d: key(Hk), draw: () => fore('all') });
    return { S, E, H };
  };
  const armL = arm('L'), armR = arm('R');
  // 弓・弦・矢 (弓は左手の直前、矢は左手の直後: 握った指の上に矢が乗る)
  parts.push({ id: 'bow', d: key(geo.G, -0.02), draw: () => drawBow(ctx, UG, geo) });
  const sm = vlerp(geo.G, geo.stringMid, 0.5);
  // [E修正8] 弦の上半分は頭より手前に来ても「頭の直前」に描く (↙↘ の引き切りで弦が顔の真ん中を斜めに横切っていた)。
  //   顎の下の引き手から上の弦は顔の縁で隠れ、弓の上端からまた現れる。物理的には顔の前だが、顔の読みやすさを優先した誇張。
  const su = vlerp(geo.tipT, geo.stringMid, 0.5);
  parts.push({ id: 'stringU', d: Math.min(key(su), LAYER.head - 0.5), draw: () => polyStroke(ctx, [UG(...geo.tipT), UG(...geo.stringMid)], (P.draw > 0.5 ? 1.2 : 1.0) * DRAW.lw, ARC.string) });
  parts.push({ id: 'string', d: key(sm), draw: () => {
    polyStroke(ctx, [UG(...geo.stringMid), UG(...geo.tipB)], (P.draw > 0.5 ? 1.2 : 1.0) * DRAW.lw, ARC.string);
    if (P.released >= 0 && P.released < 0.16) {                                  // [E] 離れの瞬間: 弦の跳ね返りを示す短い線 (誇張)
      const m = UG(...geo.stringMid), tT = UG(...geo.tipT), tB = UG(...geo.tipB), k = 1 - P.released / 0.16;
      const vx = tT.x - tB.x, vy = tT.y - tB.y, vl = Math.hypot(vx, vy) || 1, nx = -vy / vl, ny = vx / vl;
      ctx.save(); ctx.globalAlpha = 0.85 * k;
      for (const s of [-1, 1]) for (const o of [5, 9]) strokePath(ctx, [{ x: m.x + vx / vl * o * s * 0.9 + nx * 2, y: m.y + vy / vl * o * s * 0.9 + ny * 2 }, { x: m.x + vx / vl * o * s * 1.2 + nx * 6, y: m.y + vy / vl * o * s * 1.2 + ny * 6 }], 1.0 * DRAW.lw, false, PAL.ink, 1);
      ctx.restore();
    }
  } });
  const fwd = groundDirScreen(dir.f[0], dir.f[1]), fl = Math.hypot(fwd.x, fwd.y), fd = { x: fwd.x / fl, y: fwd.y / fl };
  let arrowInfo = null;
  if (P.arrow) {
    const nock = UG(...P.rHand);
    let d = fd, len = ARROW_LEN;
    if (P.arrow.mode === 'hand') {
      const q = UG(P.rHand[0] + P.arrow.dir[0], P.rHand[1] + P.arrow.dir[1], P.rHand[2] + P.arrow.dir[2]);
      const vx = q.x - nock.x, vy = q.y - nock.y, vl = Math.hypot(vx, vy) || 1;
      d = { x: vx / vl, y: vy / vl }; len = ARROW_LEN * Math.min(1, vl);
    }
    arrowInfo = { nock, d, len };
    const ha = P.rHand[0] > -2 ? [P.rHand[0] + 10, P.rHand[1], P.rHand[2]] : P.rHand;
    parts.push({ id: 'arrow', d: (P.arrow.mode === 'nock' ? key(geo.G) : key(ha)) + 0.02, draw: () => drawArrowShape(ctx, nock, d, len, DRAW.lw) });
  }
  renderRig(ctx, x, y, scale, parts, { prefix: 'archer', boil, shadow: opts.shadow, shadowSeed: 'hero-shadow' });
  const S = p => ({ x: x + p.x * scale, y: y + p.y * scale });
  return {
    leftHand: S(UG(...P.grip)), rightHand: S(UG(...P.rHand)), stringMid: S(UG(...geo.stringMid)),
    tips: [S(UG(...geo.tipT)), S(UG(...geo.tipB))], arrow: arrowInfo && { nock: S(arrowInfo.nock), d: arrowInfo.d, len: arrowInfo.len * scale },
    fwd: fd, order: parts.slice().sort((p, q) => p.d - q.d).map(p => p.id), pose: P, arms: { L: armL, R: armR }, head: S(hc),
  };
}

/** 放つ瞬間の矢筈の位置 (足元からの画面オフセット、ローカルpx) と向き (実験Dと同じ) */
export function archerReleaseInfo(dirKey) {
  const P = archerPose('attack', ARCHER_RELEASE_U * ARCHER_ATTACK_T - 1e-4), dir = DIRS[dirKey];
  const w = bodyToWorld(dir, P.rHand[0] + P.body[0], P.rHand[1] + P.body[1]);
  return { nock: { x: (w.X - w.Y) * KX, y: (w.X + w.Y) * KY_G() - (P.rHand[2] + P.body[2]) }, f: dir.f };
}

/** 射撃のコマ割り: 重要な瞬間 (つがえ・引き切り・離れ u=0.75・飛翔の始まり) を必ず含む不等間隔の20コマ */
export const ARCHER_ATTACK_KEYS = Object.freeze([0, 0.07, 0.14, 0.2, 0.25, 0.3, 0.36, 0.41, 0.45, 0.5, 0.55, 0.6, 0.66, 0.72, 0.75, 0.78, 0.82, 0.87, 0.93, 0.97]);
/**
 * 弓使いのキャラクター定義。
 *   コマ数は 待機16・歩行10・射撃20 の計46コマ × 4方向 = 184コマ (実験D・Eと同じ)。
 *   projectile: 矢を放つ瞬間 (攻撃の位相 releaseAt)・放つ位置 origin(direction)・矢の形 draw・長さ length。
 *   放った後の矢はキャラの絵から切り離し、Renderer の projectiles として描く。
 */
export const archer = Object.freeze({
  id: 'archer',
  label: '弓使い',
  kind: 'humanoid',
  draw: drawArcherRig,
  actions: {
    idle: { period: ARCHER_IDLE_PERIOD, frames: 16 },
    walk: { period: 1 / WALK_HZ, frames: 10 },
    attack: { period: ARCHER_ATTACK_T, keys: ARCHER_ATTACK_KEYS, once: true, releaseAt: ARCHER_RELEASE_U },
  },
  frameBox: { x0: -74, x1: 74, y0: -124, y1: 20 },
  equipment: { leftHand: 'bow', rightHand: 'string', back: 'quiver' },
  projectile: { type: 'arrow', releaseAt: ARCHER_RELEASE_U, origin: archerReleaseInfo, draw: drawArrowShape, length: ARROW_LEN },
});
