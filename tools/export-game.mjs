import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCharacters, ROOT } from './sync-catalog.mjs';
import { moduleFiles } from './lib/module-files.mjs';

export async function exportGame({ ids, out=path.join(ROOT,'exports','game-kit'), root=ROOT }) {
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>!id))throw new Error('--characters warrior,archer のようにIDを指定してください');
  if(new Set(ids).size!==ids.length)throw new Error('選択IDが重複しています');
  const catalog=await discoverCharacters(root),selected=ids.map(id=>{const c=catalog.find(c=>c.id===id);if(!c)throw new Error(`未登録のID「${id}」。登録済み: ${catalog.map(c=>c.id).join(', ')}`);return c;});
  const folders=selected.filter(c=>!c.builtin).map(c=>path.posix.dirname(c.source));
  const graph=await moduleFiles(root,selected.map(c=>c.source),folders);
  out=path.resolve(out);root=path.resolve(root);const relative=path.relative(root,out),back=path.relative(out,root);
  const containsRoot=!back||(!back.startsWith('..'+path.sep)&&back!=='..'&&!path.isAbsolute(back));
  if(containsRoot||['src','characters','studio','game','docs','tools','tests'].some(d=>relative===d||relative.startsWith(d+path.sep)))throw new Error('出力先はソースと重ならない新しいフォルダにしてください');
  try{await readdir(out);throw new Error(`出力先は既に存在します: ${out}。別の --out を指定してください`);}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(out,{recursive:true});
  await cp(path.join(root,'src'),path.join(out,'src'),{recursive:true});
  for(const file of graph.filter(f=>!f.startsWith('src/'))){await mkdir(path.dirname(path.join(out,file)),{recursive:true});await cp(path.join(root,file),path.join(out,file));}
  await mkdir(path.join(out,'characters'),{recursive:true});
  const imports=selected.map((c,i)=>`import { ${c.exportName} as c${i} } from ${JSON.stringify('../'+c.source)};`).join('\n');
  await writeFile(path.join(out,'characters/register.js'),`${imports}\nexport const characters = [${selected.map((_,i)=>'c'+i).join(', ')}];\nexport function registerCharacters(renderer) { for (const character of characters) renderer.registerCharacter(character); return characters; }\n`);
  await writeFile(path.join(out,'index.html'),KIT_HTML);await writeFile(path.join(out,'main.js'),KIT_JS);
  await mkdir(path.join(out,'tools'),{recursive:true});await cp(path.join(root,'tools/serve.mjs'),path.join(out,'tools/serve.mjs'));
  await writeFile(path.join(out,'package.json'),JSON.stringify({private:true,type:'module',scripts:{start:'node tools/serve.mjs 8091'}},null,2)+'\n');
  await writeFile(path.join(out,'USE_IN_GAME.md'),`# Inkstone ゲーム用キット\n\n選択: ${ids.join(', ')}\n\nこのフォルダだけで動作します。元のStudioは不要です。Node.js 18以上で次を実行してください。\n\n\`\`\`sh\nnode tools/serve.mjs 8091\n\`\`\`\n\nhttp://127.0.0.1:8091/ を開きます。file:// では起動できません。ゲームへは src/ と characters/ を相対位置を保ってコピーしてください。main.js は部屋・登録・Live/Cachedの最小例です。\n\n共通 src/ は未改変で全体を含み、内蔵3体のソースも静的依存として残ります。登録するのは選択したキャラクターだけです。未選択の追加キャラクターやStudio UIは含みません。\n\n\`\`\`js\nimport { createRenderer } from './src/index.js';\nimport { registerCharacters } from './characters/register.js';\nconst renderer = createRenderer({ canvas, characters: [], mode: 'live' });\nregisterCharacters(renderer);\nrenderer.setMode('cached');\n// 自分のゲームループで renderer.render({ units, timeSeconds }) を呼びます。\n\`\`\`\n\nキャッシュは表示倍率ごとに同期生成されます。終了時は renderer.dispose() を呼んでください。ライブラリ更新時はsrc/全体を同じ版で置き換え、登録・描画・範囲・遮蔽を再確認してください。個別ファイルの混在は避けてください。\n`);
  const manifest={generatedAt:new Date().toISOString(),selected:ids,additionalModules:graph.filter(f=>!f.startsWith('src/')),sharedLibrary:'src/ (complete, unmodified)',studioIncluded:false};
  await writeFile(path.join(out,'export-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return{out,...manifest};
}

const KIT_HTML=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inkstone Game Kit</title><style>body{font:18px/1.6 system-ui;background:#f3eee3;color:#282e27;max-width:1100px;margin:24px auto;padding:20px}h1{font-size:32px}label{display:inline-block;margin:8px}select,button{font:inherit;min-height:50px;padding:8px;border:2px solid #60705d;border-radius:6px}canvas{width:100%;display:block;background:#eee9dd;border:1px solid #60705d}pre{font-size:16px;white-space:pre-wrap}</style><h1>Inkstone Game Kit</h1><p>選択したキャラクターを、独立したRendererで表示しています。</p><label>キャラクター <select id="character"></select></label><label id="direction-label">向き <select id="direction"><option>NW</option><option>NE</option><option selected>SW</option><option>SE</option></select></label><label>動作 <select id="action"></select></label><label>描画方式 <select id="mode"><option value="live">Live Vector</option><option value="cached">Cached Frames</option></select></label><canvas id="scene" aria-label="選択したキャラクターの部屋"></canvas><p id="status" role="status"></p><details><summary>診断情報</summary><pre id="diagnostics"></pre></details><script type="module" src="./main.js"></script></html>`;
const KIT_JS=`import { createRenderer } from './src/index.js';
import { characters, registerCharacters } from './characters/register.js';
const $=id=>document.getElementById(id), canvas=$('scene');
const renderer=createRenderer({canvas,width:1000,height:620,dpr:1,characters:[],room:{id:'portable-kit',width:6,depth:6,doors:[{wall:'left',at:2.5}],objects:[{type:'column',cell:[1,1]},{type:'chest',cell:[4,1]}]},xray:false});
registerCharacters(renderer);renderer.fitToRoom({margin:22,maxScale:1});
for(const def of characters){const option=document.createElement('option');option.value=def.id;option.textContent=def.label||def.id;$('character').append(option);}
let def=characters[0],time=0,last=null;
function select(){def=characters.find(c=>c.id===$('character').value);time=0;$('action').replaceChildren();for(const action of Object.keys(def.actions)){const o=document.createElement('option');o.value=action;o.textContent=action;$('action').append(o);}$('direction-label').hidden=def.directional===false;renderer.disposeCaches();}
$('character').onchange=select;$('action').onchange=()=>time=0;$('mode').onchange=()=>{renderer.setMode($('mode').value);if($('mode').value==='live')renderer.disposeCaches();};select();
function tick(now){time+=last===null||document.hidden?0:Math.min(.05,(now-last)/1000);last=now;const info=renderer.render({timeSeconds:time,units:[{id:'selected',character:def.id,x:3.5,y:3.5,direction:$('direction').value,action:$('action').value,actionTime:time}]});$('status').textContent='描画中: '+def.id+' / '+$('action').value+' / '+$('mode').value+' / 警告 '+info.warnings.length;if(document.querySelector('details').open)$('diagnostics').textContent=JSON.stringify(renderer.getDiagnostics(),null,2);requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.addEventListener('pagehide',event=>{if(!event.persisted)renderer.dispose();});
`;
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2);let ids,out;for(let i=0;i<args.length;i++){if(args[i]==='--characters')ids=args[++i]?.split(',').map(s=>s.trim());else if(args[i]==='--out')out=args[++i];else throw new Error('使い方: node tools/export-game.mjs --characters warrior,archer [--out 新しい出力先]');}console.log(JSON.stringify(await exportGame({ids,out}),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
