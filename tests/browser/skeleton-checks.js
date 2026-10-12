import { skeleton } from '../../src/characters/skeleton.js';
import { skeleton as before } from '../fixtures/skeleton-before.js';
import { isolateDrawing } from '../../src/core/settings.js';
import { createFrameCacheStore } from '../../src/rendering/cache.js';
import { frameCanvas } from '../../src/rendering/sprites.js';
import { catalog } from '../../characters/catalog.js';
import { warrior } from '../../characters/warrior/character.js';

const dirs=['NW','NE','SW','SE'],draw={lw:.82,boil:true,footGround:true,linearStance:true};
const section=document.createElement('section');
section.innerHTML=`<h2>骸骨兵の造形・保持・キャッシュ検証</h2><button id="skeleton-run">骸骨兵を検証する</button><p id="skeleton-status">未実行</p><pre id="skeleton-results"></pre><h3>4方向・同倍率 2× / 位相0</h3><canvas id="skeleton-directions" width="1120" height="320" style="max-width:100%;height:auto"></canvas><p><a id="directions-download" download="four-directions.png">4方向画像を保存</a></p><h3>参考に近いSE・拡大4×</h3><canvas id="skeleton-closeup" width="560" height="560" style="max-width:100%;height:auto"></canvas><p><a id="closeup-download" download="reference-angle.png">拡大画像を保存</a></p><h3>変更前→変更後・同倍率2×</h3><canvas id="skeleton-comparison" width="650" height="320" style="max-width:100%;height:auto"></canvas><p><a id="comparison-download" download="before-after.png">比較画像を保存</a></p><p><a href="../../#character/skeleton">Studioで待機の動きを確認</a></p>`;
document.body.append(section);
section.insertAdjacentHTML('beforeend','<h3>人間型の頭身基準 / 同倍率2×・同じ足元原点</h3><canvas id="humanoid-proportions" width="800" height="340" style="max-width:100%;height:auto"></canvas><p><a id="proportions-download" download="humanoid-proportions.png">衛士と骸骨の比較画像を保存</a></p>');
const $=id=>section.querySelector('#'+id);
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function differences(a,b){let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;}
function canvas(id){const c=$(id),g=c.getContext('2d');g.fillStyle='#fffcf5';g.fillRect(0,0,c.width,c.height);g.fillStyle='#36342b';g.font='18px system-ui';return {c,g};}
function artwork(){
 const standard=canvas('humanoid-proportions');
 for(const [definition,x,label] of [[warrior,200,'Cinder Guard / ~2.2 heads'],[skeleton,600,'Skeleton / ~2.2 heads']]){
  standard.g.fillText(label,x-145,30);
  definition.draw(standard.g,x,295,'SE','idle',0,2,{shadow:false});
  standard.g.save();standard.g.strokeStyle='#9b9280';standard.g.lineWidth=1;standard.g.setLineDash([4,4]);
  // Approximate authoring landmarks, excluding feather, gear and shadow.
  const crown=definition===warrior?-91.83:-90.7,chin=definition===warrior?-49.53:-46.05;
  for(const y of [crown,chin,0]){standard.g.beginPath();standard.g.moveTo(x-78,295+y*2);standard.g.lineTo(x+78,295+y*2);standard.g.stroke();}
  standard.g.restore();
 }
 $('proportions-download').href=standard.c.toDataURL('image/png');
 const sheet=canvas('skeleton-directions');
 dirs.forEach((d,i)=>{sheet.g.fillText(d+' / idle',i*280+90,28);skeleton.draw(sheet.g,i*280+140,285,d,'idle',0,2,{shadow:false});});
 const big=canvas('skeleton-closeup');skeleton.draw(big.g,280,510,'SE','idle',0,4,{shadow:false});
 const pair=canvas('skeleton-comparison');pair.g.fillText('BEFORE / single view',35,28);pair.g.fillText('AFTER / SE',360,28);before.draw(pair.g,165,282,null,'idle',0,2,{shadow:false});skeleton.draw(pair.g,480,282,'SE','idle',0,2,{shadow:false});
 $('comparison-download').href=pair.c.toDataURL('image/png');$('directions-download').href=sheet.c.toDataURL('image/png');$('closeup-download').href=big.c.toDataURL('image/png');
}
$('skeleton-run').onclick=async()=>{
 $('skeleton-status').textContent='検証中';await new Promise(resolve=>setTimeout(resolve,0));
 const r={generatedAt:new Date().toISOString(),scales:[1.25,2.2],directions:dirs,actions:Object.keys(skeleton.actions),comparisons:0,clipSamples:0,errors:[],bounds:{},cacheFrames:0};
 const check=(ok,message)=>{if(!ok)r.errors.push(message);};
 try{isolateDrawing(draw,()=>{
  artwork();const entry=catalog.find(c=>c.id==='skeleton');check(catalog.filter(c=>c.id==='skeleton').length===1,'duplicate skeleton');check(entry.directions.join()===dirs.join(),'catalog directions');
  for(const scale of r.scales){const store=createFrameCacheStore(),e=store.get(skeleton,scale,draw);check(e.count===216,'expected 216 frames');r.cacheFrames=e.count;
   for(const direction of dirs){
    for(let i=0;i<16;i++){
     const t=i/16*skeleton.actions.idle.period;
     const c=frameCanvas(scale,skeleton.frameBox,g=>skeleton.draw(g,0,0,direction,'idle',t,1,{shadow:false}));
     const diff=differences(pixels(c),pixels(e.frames[direction+'idle'][i]));check(diff===0,`${scale}/${direction}/${i}: live-cache ${diff}`);r.comparisons++;
     check(store.frame(e,direction,'idle',t+1e-8)===e.frames[direction+'idle'][i],`frame selection ${direction}/${i}`);
    }
   }
   // A new definition object with the same id must invalidate cached pixels.
   const replaced=store.get({...skeleton},scale,draw);check(replaced!==e&&e.frames.NWidle[0].width===0,'stale definition cache');
   store.dispose();check(store.stats().totalFrames===0,'cache leak');
  }
  for(const direction of dirs){let firstFeet;const b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
   for(let i=0;i<64;i++){
    const t=i/64*skeleton.actions.idle.period;
    let info;const c=frameCanvas(2,{x0:-100,x1:100,y0:-150,y1:40},g=>{info=skeleton.draw(g,0,0,direction,'idle',t,1,{shadow:false});});
    const p=pixels(c);let count=0,clipped=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>2){const px=x/2-100,py=y/2-150;count++;b.x0=Math.min(b.x0,px);b.y0=Math.min(b.y0,py);b.x1=Math.max(b.x1,px);b.y1=Math.max(b.y1,py);const box=skeleton.frameBox;if(px<box.x0||px>=box.x1||py<box.y0||py>=box.y1)clipped++;}
    check(count>0&&!clipped,`${direction}/${i}: blank or clipped ${clipped}`);r.clipSamples++;
    const feet=JSON.stringify(info.feet);if(!firstFeet)firstFeet=feet;check(feet===firstFeet,`feet slide ${direction}/${i}`);
    check(JSON.stringify(info.rightHand)===JSON.stringify(info.swordGrip),'sword disconnected');check(JSON.stringify(info.leftHand)===JSON.stringify(info.shieldGrip),'shield disconnected');
    const expected=direction==='NW'||direction==='SW'?'armR':'armL';check(info.order.indexOf(expected)<info.order.indexOf('ribs'),`far arm order ${direction}`);
   }r.bounds[direction]=b;
  }
  // Texture is invariant even when global line-boil is enabled. Full-cycle pose is seamless.
  const render=(t,boil)=>isolateDrawing({...draw,boil},()=>frameCanvas(2,skeleton.frameBox,g=>skeleton.draw(g,0,0,'SE','idle',t,1,{shadow:false})));
  check(differences(pixels(render(.37,true)),pixels(render(.37,false)))===0,'texture depends on lineBoil');
  check(differences(pixels(render(0,true)),pixels(render(skeleton.actions.idle.period,true)))===0,'idle seam');
  check(differences(pixels(render(.37,true)),pixels(render(.37,true)))===0,'non deterministic');
 });}catch(e){r.errors.push(String(e));}
 r.passed=r.errors.length===0;$('skeleton-results').textContent=JSON.stringify(r,null,2);$('skeleton-status').textContent=r.passed?'PASS':'FAIL';
};
