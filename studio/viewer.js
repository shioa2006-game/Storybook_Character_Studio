import { createCharacterView } from '../src/index.js';
const directionLabels={NW:'左上 NW',NE:'右上 NE',SW:'左下 SW',SE:'右下 SE'};
const actionLabels={idle:'待機',walk:'歩行',attack:'攻撃'};
const labelAction=a=>actionLabels[a]||a;
const button=(text,data,value)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset[data]=value;b.setAttribute('aria-pressed','false');return b;};

export function mountViewer(root,entry) {
  root.innerHTML=`<a class="back" href="#gallery">← キャラクター一覧へ</a><section class="detail-title"><p class="category"></p><h1></h1><p class="description"></p></section>
  <div class="viewer-shell"><div class="stage"><canvas id="hero" aria-label="キャラクターのプレビュー"></canvas></div><div class="stage-caption"><strong id="pose"></strong><span id="size-label"></span></div>
  <div class="playback"><button id="play" class="primary">一時停止</button><div class="phase-wrap"><label for="phase">動作の位相 <output id="phase-value">0.000</output></label><input id="phase" type="range" min="0" max="1000" value="0" step="1"></div><label for="speed">再生速度<br><select id="speed"><option value="1">通常 1×</option><option value="0.5">スロー 0.5×</option><option value="0.25">スロー 0.25×</option></select></label></div>
  <div class="mode-row"><fieldset><legend>表示サイズ</legend><div class="button-row" id="sizes"></div></fieldset><fieldset><legend>描画方式</legend><div class="button-row" id="modes"></div></fieldset></div></div>
  <div class="controls"><fieldset id="direction-field"><legend>向き</legend><div class="button-row" id="directions"></div></fieldset><fieldset><legend>動作</legend><div class="button-row" id="actions"></div></fieldset></div>
  <p id="capability-note" class="notice" hidden></p><p id="busy" role="status" aria-live="polite"></p>
  <div class="extra-actions"><button id="show-directions">全方向を見る</button><button id="show-all">全方向・全動作を見る</button><a id="demo-link" class="button" hidden>ダンジョンで見る</a></div>
  <section class="sheet-section" id="sheet" hidden><div class="sheet-controls"><h2 id="sheet-title"></h2><button id="close-sheet">一覧を閉じる</button></div><p>上の再生・位相・描画方式と連動します。</p><div class="sheet-grid"></div></section>
  <details id="technical"><summary>開発者向け情報・ゲームへの持ち出し</summary><p>RGBA理論容量は画像の幅×高さ×4です。ブラウザーやGPUの実メモリ使用量ではありません。</p><p>Cached Framesは選択した1体の全方向・全動作を初回に生成します。大きな表示ほど容量が増えます。</p><pre id="export-command"></pre><a href="./docs/EXPORT_GUIDE.md">持ち出し手順を読む</a><pre id="diagnostics"></pre></details>`;
  const $=id=>root.querySelector('#'+id),def=entry.definition;
  // Keep direction/action choices beside the artwork on wide screens; stack
  // without shrinking text when the viewport or browser zoom reduces space.
  root.querySelector('.viewer-shell').insertBefore(root.querySelector('.controls'),root.querySelector('.playback'));
  root.querySelector('h1').textContent=entry.name;root.querySelector('.category').textContent=entry.category;root.querySelector('.description').textContent=entry.description;
  $('export-command').textContent=`node tools/export-game.mjs --characters ${entry.id}`;
  $('demo-link').href=`./game/index.html?character=${encodeURIComponent(entry.id)}`;
  $('demo-link').hidden=false;
  const state={direction:entry.preview.direction||'SE',action:'idle',phase:entry.preview.phase,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,speed:1,mode:'live',size:'large'};
  const view=createCharacterView({canvas:$('hero'),width:700,height:440,dpr:1,characters:[def],lineBoil:true,footFix:true,lineScale:.82});
  let sheetView=null,sheetCells=[],sheetType='',disposed=false,dirty=true,last=null,raf=0,modeToken=0,resizeTimer,scale=1,width=700,height=440,sheetViewCanvas;
  for(const d of entry.directions)$('directions').append(button(directionLabels[d],'direction',d));
  for(const a of entry.actions)$('actions').append(button(labelAction(a),'action',a));
  for(const [v,l]of [['large','拡大表示'],['normal','通常ゲームサイズ']])$('sizes').append(button(l,'size',v));
  for(const [v,l]of [['live','Live Vector'],['cached','Cached Frames']])$('modes').append(button(l,'mode',v));
  if(!entry.directions.length){$('direction-field').hidden=true;$('capability-note').hidden=false;$('capability-note').textContent=`このキャラクターは方向を持たない一枚絵型です。対応動作: ${entry.actions.map(labelAction).join('、')}。`;$('show-directions').hidden=true;$('show-all').hidden=true;}
  function selected(){for(const key of ['direction','action','size','mode'])root.querySelectorAll(`[data-${key}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===state[key])));$('play').textContent=state.playing?'一時停止':'再生する';}
  function resize(){if(disposed)return;width=Math.round(root.querySelector('.stage').clientWidth);height=root.querySelector('.stage').clientHeight;const b=def.frameBox;scale=state.size==='normal'?Math.min(1.25,(width-36)/(b.x1-b.x0)):Math.min(2.2,(width-40)/(b.x1-b.x0),(height-40)/(b.y1-b.y0));view.resize(width,height,1);view.setScale(scale);dirty=true;}
  function diagnostics(){if($('technical').open)$('diagnostics').textContent=JSON.stringify({id:entry.id,source:entry.source,builtin:entry.builtin,directions:entry.directions,actions:def.actions,frameBox:def.frameBox,view:view.getDiagnostics(),sheet:sheetView?.getDiagnostics()||null},null,2);}
  function render(){const b=def.frameBox,time=Math.min(state.phase,.999999)*def.actions[state.action].period;
    view.render({character:entry.id,direction:state.direction,action:state.action,actionTime:time,originX:width/2-(b.x0+b.x1)*scale/2,originY:height/2-(b.y0+b.y1)*scale/2,tile:false,background:'#eee9dd',projectile:false});
    $('pose').textContent=`${entry.directions.length?directionLabels[state.direction]+' / ':''}${labelAction(state.action)}`;$('size-label').textContent=state.size==='normal'?`通常ゲームサイズ · ${scale.toFixed(2)}×`:'拡大表示';$('phase').value=Math.round(state.phase*1000);$('phase-value').textContent=state.phase.toFixed(3);
    if(sheetView){const s=sheetView.getDiagnostics().scale;for(const cell of sheetCells){sheetView.render({character:entry.id,direction:cell.direction,action:cell.action,actionTime:Math.min(state.phase,.999999)*def.actions[cell.action].period,originX:140-(b.x0+b.x1)*s/2,originY:145-(b.y0+b.y1)*s/2,tile:false,background:'#fffcf5',projectile:false});cell.canvas.getContext('2d').drawImage(sheetViewCanvas,0,0);}}
    dirty=false;
  }
  function closeSheet(){sheetView?.dispose();sheetView=null;sheetViewCanvas=null;sheetCells.forEach(c=>{c.canvas.width=0;c.canvas.height=0;});sheetCells=[];$('sheet').hidden=true;$('sheet').querySelector('.sheet-grid').replaceChildren();sheetType='';}
  function openSheet(type){closeSheet();sheetType=type;$('sheet').hidden=false;$('sheet-title').textContent=type==='all'?'全方向・全動作':'全方向';const b=def.frameBox;
    sheetViewCanvas=document.createElement('canvas');sheetView=createCharacterView({canvas:sheetViewCanvas,width:280,height:290,dpr:1,scale:Math.min(1.65,250/(b.x1-b.x0),252/(b.y1-b.y0)),characters:[def],mode:state.mode,lineBoil:true,footFix:true,lineScale:.9});
    for(const action of(type==='all'?entry.actions:[state.action]))for(const direction of(entry.directions.length?entry.directions:['SE'])){const fig=document.createElement('figure');fig.className='sheet-cell';const cap=document.createElement('figcaption');cap.textContent=`${directionLabels[direction]} / ${labelAction(action)}`;const canvas=document.createElement('canvas');canvas.width=280;canvas.height=290;fig.append(cap,canvas);$('sheet').querySelector('.sheet-grid').append(fig);sheetCells.push({canvas,action,direction});}
    dirty=true;$('sheet').scrollIntoView({block:'start',behavior:'instant'});
  }
  root.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{state.direction=b.dataset.direction;dirty=true;selected();});
  root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{state.action=b.dataset.action;state.phase=0;if(sheetType==='directions')openSheet('directions');dirty=true;selected();});
  root.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{if(state.size===b.dataset.size)return;state.size=b.dataset.size;view.disposeCaches();resize();selected();});
  root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=async()=>{const token=++modeToken,mode=b.dataset.mode;$('busy').textContent=mode==='cached'?'キャッシュを準備しています…':'';await new Promise(r=>setTimeout(r,0));if(disposed||token!==modeToken)return;state.mode=mode;view.setMode(mode);sheetView?.setMode(mode);if(mode==='live'){view.disposeCaches();sheetView?.disposeCaches();}dirty=true;selected();render();diagnostics();$('busy').textContent='';});
  $('play').onclick=()=>{state.playing=!state.playing;last=null;selected();};$('phase').oninput=e=>{state.phase=Number(e.target.value)/1000;state.playing=false;dirty=true;selected();};$('speed').onchange=e=>{state.speed=Number(e.target.value);};
  $('show-directions').onclick=()=>openSheet('directions');$('show-all').onclick=()=>openSheet('all');$('close-sheet').onclick=()=>{closeSheet();$('show-all').focus();diagnostics();};$('technical').ontoggle=diagnostics;
  const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,120);});observer.observe(root.querySelector('.stage'));
  const visibility=()=>{last=null;};document.addEventListener('visibilitychange',visibility);
  function tick(now){if(disposed)return;const dt=last===null?0:Math.min(.08,(now-last)/1000);last=now;if(!document.hidden){if(state.playing){state.phase=(state.phase+dt*state.speed/def.actions[state.action].period)%1;dirty=true;}if(dirty)render();}raf=requestAnimationFrame(tick);}
  selected();resize();render();raf=requestAnimationFrame(tick);
  return ()=>{disposed=true;modeToken++;cancelAnimationFrame(raf);clearTimeout(resizeTimer);observer.disconnect();document.removeEventListener('visibilitychange',visibility);closeSheet();view.dispose();$('hero').width=0;$('hero').height=0;};
}
