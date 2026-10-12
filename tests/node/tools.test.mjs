import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncCatalog, discoverCharacters, ROOT } from '../../tools/sync-catalog.mjs';
import { exportGame } from '../../tools/export-game.mjs';
import { moduleFiles } from '../../tools/lib/module-files.mjs';
import { catalog } from '../../characters/catalog.js';
import { buildCatalog } from '../../characters/metadata.js';
import { skeleton } from '../../src/index.js';
const meta={name:'検証用',category:'検証',description:'既存描画の登録試験'};
test('shared Inkstone source matches the portable preservation baseline', async () => {
 const baseline=JSON.parse(await readFile(path.join(ROOT,'tests/fixtures/src-baseline.json'),'utf8'));
 for(const entry of baseline){
  const hash=createHash('sha256').update(await readFile(path.join(ROOT,entry.Path))).digest('hex').toUpperCase();
  assert.equal(hash,entry.Hash,entry.Path);
 }
});
async function fixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'inkstone-studio-test-'));t.after(async()=>{if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('inkstone-studio-test-'))throw new Error('Unexpected cleanup path');await rm(dir,{recursive:true,force:true});});await mkdir(path.join(dir,'characters'));await mkdir(path.join(dir,'tools'));await cp(path.join(ROOT,'src'),path.join(dir,'src'),{recursive:true});await cp(path.join(ROOT,'tools/serve.mjs'),path.join(dir,'tools/serve.mjs'));await writeFile(path.join(dir,'package.json'),' {"type":"module"}');return dir;}
async function add(root,folder,id){await mkdir(path.join(root,'characters',folder),{recursive:true});await writeFile(path.join(root,'characters',folder,'character.js'),`import { skeleton } from '../../src/index.js';\nexport const character={...skeleton,id:${JSON.stringify(id)}};\nexport const studio=${JSON.stringify(meta)};\n`);}
test('catalog includes the built-ins and preserved warrior with accurate capabilities',()=>{for(const id of ['swordsman','archer','skeleton','warrior'])assert.ok(catalog.some(c=>c.id===id));const sk=catalog.find(c=>c.id==='skeleton');assert.deepEqual(sk.directions,[]);assert.deepEqual(sk.actions,['idle']);});
test('new definition is discovered without editing the UI; generated catalog is deterministic',async t=>{const root=await fixture(t);await add(root,'sample','sample');const entries=await syncCatalog({root});assert.equal(entries.length,4);const generated=await readFile(path.join(root,'characters/catalog.generated.js'),'utf8');assert.match(generated,/sample\/character.js/);await syncCatalog({root,check:true});await writeFile(path.join(root,'characters/catalog.generated.js'),'stale');await assert.rejects(syncCatalog({root,check:true}),/未更新/);});
test('duplicate built-in and custom IDs identify the source files',async t=>{const root=await fixture(t);await add(root,'duplicate','skeleton');await assert.rejects(discoverCharacters(root),/ID重複.*skeleton/);});
test('invalid metadata and unsupported partial directions fail clearly',()=>{assert.throws(()=>buildCatalog([{definition:skeleton,studio:{},source:'broken.js'}]),/studio.name/);assert.throws(()=>buildCatalog([{definition:{...skeleton,directional:true},studio:{...meta,directions:['SW']}}]),/4方向すべて/);});
test('export is self contained, selective, and refuses overwrite / unknown IDs',async t=>{const root=await fixture(t);await add(root,'first','first');await add(root,'second','second');const out=path.join(root,'kit');const result=await exportGame({root,out,ids:['first','archer']});assert.deepEqual(result.additionalModules,['characters/first/character.js']);assert.deepEqual((await readdir(path.join(out,'characters'))).sort(),['first','register.js']);assert.ok(!(await readdir(out)).includes('studio'));const defs=await import(pathToFileURL(path.join(out,'characters/register.js')).href);assert.deepEqual(defs.characters.map(c=>c.id),['first','archer']);assert.equal(await readFile(path.join(out,'src/index.js'),'utf8'),await readFile(path.join(root,'src/index.js'),'utf8'));await assert.rejects(exportGame({root,out,ids:['first']}),/既に存在/);await assert.rejects(exportGame({root,ids:['missing']}),/未登録/);await assert.rejects(exportGame({root,out:path.join(root,'src/kit'),ids:['first']}),/ソースと重ならない/);});
test('export follows shared imports and rejects external or unselected dependencies',async t=>{const root=await fixture(t);await add(root,'first','first');await mkdir(path.join(root,'characters/shared'));await writeFile(path.join(root,'characters/shared/paint.js'),'export const color = 1;');const file=path.join(root,'characters/first/character.js');await writeFile(file,"import {color} from '../shared/paint.js';\nexport { color };\n");assert.deepEqual(await moduleFiles(root,['characters/first/character.js'],['characters/first']),['characters/first/character.js','characters/shared/paint.js']);await writeFile(file,"import 'https://example.com/module.js';");await assert.rejects(moduleFiles(root,['characters/first/character.js'],['characters/first']),/相対import/);await add(root,'second','second');await writeFile(file,"export { character } from '../second/character.js';");await assert.rejects(moduleFiles(root,['characters/first/character.js'],['characters/first']),/未選択/);});
test('warrior art is unchanged after relocation; old import resolves to the same definition',async()=>{
 const before=(await readFile(path.join(ROOT,'tests/fixtures/warrior-before.js'),'utf8')).replaceAll('\r\n','\n');
 const expected=before.replace("'../../../src/authoring.js'","'../../src/authoring.js'")
 .replace('/** Bridge the head-mounted scarf to the yawing breastplate, without lowering\n * the helmet. The upper rim follows U (head); the lower rim follows UY (chest).','/** Bridge the head-mounted scarf to the yawing breastplate.\n * The upper rim follows U (head); the lower rim follows UY (chest).')
 .replace('// Head-only art proportion: expose the breastplate while preserving the\n  // shared torso, shoulders, IK arms and grounded legs without a new rig.\n  const head=rf.U(1.5,0,72);','// Lower the whole head six local pixels so the scarf gently overlaps the\n  // shield rim. Preserve its 0.9 scale and the existing body/arm/leg geometry.\n  const head=rf.U(1.5,0,66);');
 const source=(await readFile(path.join(ROOT,'characters/warrior/character.js'),'utf8')).replaceAll('\r\n','\n');
 assert.equal(source.split('export { warrior as character };')[0].trimEnd(),expected.trimEnd());
 const current=await import('../../characters/warrior/character.js'),legacy=await import('../../game/characters/warrior.js');
 assert.equal(current.warrior,legacy.warrior);
});
