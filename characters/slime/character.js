/** A low, soft dome; no humanoid skeleton and no raster assets. */
import {
  TAU, WALK_HZ, DIRS, groundDirScreen, keyframes, renderRig,
  paint, ellipsePts, clipPath, fillPath, inkLine, strokePath, DRAW, PAL,
} from '../../src/authoring.js';

const IDLE_T = 3.2, WALK_T = 1 / WALK_HZ, ATTACK_T = 1.1;
const phase = (t, period) => ((t % period) + period) % period / period;
const sample = (keys, u) => keyframes(keys.map(([at, value]) => [at, [value]]), u)[0];

// Cubic curves keep the crown round and smooth, with soft lobes only at ground level.
function dome() {
  const pts = [{ x: -37, y: -1 }];
  for (const [x1,y1,x2,y2,x3,y3] of [
    [-38,-7,-32,-9,-29,-13], [-27,-18,-28,-27,-23,-35],
    [-18,-45,-9,-49,0,-49], [12,-49,23,-39,27,-26],
    [30,-18,27,-12,33,-9], [40,-6,40,0,34,2],
    [31,4,25,2,23,4], [20,9,12,9,7,5],
    [3,2,-3,3,-7,5], [-13,9,-22,8,-24,4],
    [-28,2,-34,4,-37,-1],
  ]) {
    const p = pts[pts.length-1];
    for (let i=1;i<=8;i++) {
      const t=i/8,s=1-t;
      pts.push({x:s*s*s*p.x+3*s*s*t*x1+3*s*t*t*x2+t*t*t*x3,
        y:s*s*s*p.y+3*s*s*t*y1+3*s*t*t*y2+t*t*t*y3});
    }
  }
  return pts;
}
const BODY = dome();

export function slimePose(action,t) {
  let sy=1,lift=0,reach=0,lean=0;
  if(action==='walk') {
    const u=phase(t,WALK_T);
    sy=sample([[0,1],[.18,.82],[.32,1.1],[.52,1.04],[.7,.8],[.86,1],[1,1]],u);
    // Both takeoff and touchdown have zero vertical velocity.
    if(u>.24&&u<.7)lift=9*Math.sin(Math.PI*(u-.24)/.46)**2;
  } else if(action==='attack') {
    const u=phase(t,ATTACK_T);
    sy=sample([[0,1],[.26,.77],[.42,.86],[.56,.9],[.82,1.025],[1,1]],u);
    reach=sample([[0,0],[.26,-3],[.42,17],[.56,17],[.88,0],[1,0]],u);
    lean=sample([[0,0],[.26,-.035],[.42,.17],[.56,.17],[.88,0],[1,0]],u);
  } else sy=1+.025*Math.sin(TAU*phase(t,IDLE_T));
  // Reciprocal scales keep projected area constant; shearing also has unit determinant.
  return {sy,sx:1/sy,lift,reach,lean};
}

export function drawSlime(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const p=slimePose(action,t),dir=DIRS[direction];
  const f=groundDirScreen(...dir.f),length=Math.hypot(f.x,f.y),fx=f.x/length,fy=f.y/length;
  const front=dir.f[0]+dir.f[1]>0;
  const parts=[];
  if(opts.shadow!==false) parts.push({id:'shadow',d:0,draw:()=>{
    ctx.save();ctx.globalAlpha=.18-p.lift*.007;
    fillPath(ctx,ellipsePts(fx*p.reach,fy*p.reach+3,31-p.lift*.4,6,36),'#657b78');ctx.restore();
  }});
  parts.push({id:'body',d:1,draw:()=>{
    ctx.save();ctx.translate(fx*p.reach,fy*p.reach-p.lift);
    ctx.transform(p.sx,0,-fx*p.lean,p.sy,0,0);
    const outline=paint(ctx,BODY,{fill:'#b4d1d2',w:1.8,depth:3,shadeK:.23,
      light:.28,speck:1.05,speckScale:.27,amp:.16,step:4});
    ctx.save();clipPath(ctx,outline);
    // Fixed watercolor islands deform with the body; no per-frame texture noise.
    for(const [cx,cy,rx,ry,color] of [
      [-14,-24,13,16,'#cce0dc'],[13,-18,14,16,'#9dbfc2'],
      [0,-35,17,10,'#c4dcd8'],[-24,-9,10,7,'#93b7bc'],[12,0,16,6,'#91b6bb'],
    ]) {
      ctx.globalAlpha=.24;fillPath(ctx,ellipsePts(cx,cy,rx,ry,28),color);
    }
    ctx.globalAlpha=1;
    // Broad ivory gleam, kept away from the crown silhouette.
    ctx.save();ctx.translate(-15,-35);ctx.rotate(.6);
    paint(ctx,ellipsePts(0,0,3.2,8,28),{fill:'#f0f0d9',w:0,depth:0,speck:.2,amp:.15});
    ctx.restore();
    for(const [cx,cy,rx,ry] of [[-5,-43,1.8,1.1],[-28,-5,3.1,1.2],[17,2,3,1],[-17,3,2,1]])
      fillPath(ctx,ellipsePts(cx,cy,rx,ry,20),'#e5ead7');
    ctx.restore();
    // Small skirt folds, never spikes on the head.
    for(const line of [[[-30,-2],[-26,-3],[-23,-1]],[[-20,4],[-15,5],[-11,4]],[[11,4],[16,5],[21,3]]])
      inkLine(ctx,line.map(([x,y])=>({x,y})),{w:.55*DRAW.lw,amp:.12,color:'#526d70'});
    if(front) {
      const faceX=fx*8;
      for(const [dx,dy,rx] of [[-7,0,1.5],[7,-2,1.35]])
        paint(ctx,ellipsePts(faceX+dx,-23+dy,rx,3.1,20),{fill:PAL.ink,w:.6,depth:0,speck:0,amp:.1});
      const mouth=[];
      for(let i=0;i<=12;i++) {
        const a=Math.PI*i/12;
        mouth.push({x:faceX+Math.cos(a)*2.6,y:-16+Math.sin(a)*1.5});
      }
      strokePath(ctx,mouth,.95*DRAW.lw,false,PAL.ink);
    }
    ctx.restore();
  }});
  renderRig(ctx,x,y,scale,parts,{prefix:'slime',boil:0,shadow:false});
}

export const character = Object.freeze({
  id:'slime',label:'スライム',kind:'creature',directional:true,draw:drawSlime,
  actions:{
    idle:{period:IDLE_T,frames:20},
    walk:{period:WALK_T,keys:[0,.09,.18,.24,.3,.36,.43,.5,.57,.64,.7,.78,.86,.94]},
    attack:{period:ATTACK_T,keys:[0,.1,.2,.26,.32,.37,.42,.49,.56,.65,.74,.82,.88,.94,.98],once:true},
  },
  frameBox:{x0:-80,x1:80,y0:-82,y1:30},
});
export const studio = {
  name:'スライム',category:'魔物',
  description:'淡い青色の、やわらかな小さなスライム。丸い体を縮めて跳ね、体当たりで攻撃します。',
  preview:{direction:'SE',phase:0},
};
