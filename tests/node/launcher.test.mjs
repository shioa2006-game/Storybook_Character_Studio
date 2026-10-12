import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findOrStartStudio } from '../../tools/lib/studio-launch.mjs';

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'inkstone-launch-test-'));
  const children=[];
  t.after(async()=>{
    for(const child of children)if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}
    if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('inkstone-launch-test-'))throw Error('Unexpected cleanup path');
    await rm(root,{recursive:true,force:true});
  });
  await mkdir(path.join(root,'tools'));
  await cp(new URL('../../tools/serve.mjs',import.meta.url),path.join(root,'tools/serve.mjs'));
  await writeFile(path.join(root,'index.html'),'<h1>Identical studio HTML</h1>');
  return {root,start:async ports=>{const result=await findOrStartStudio(root,{ports});if(result.child)children.push(result.child);return result;}};
}
async function listen(t,server){server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();}));return server.address().port;}

test('launcher reuses its own folder and skips another copy with identical HTML',async t=>{
  const a=await fixture(t),b=await fixture(t),first=await a.start([0]);
  const port=Number(new URL(first.url).port);
  const reused=await a.start([port]);assert.equal(reused.reused,true);assert.equal(reused.child,null);
  const second=await b.start([port,0]);assert.equal(second.reused,false);assert.notEqual(second.url,first.url);
  assert.notEqual((await fetch(first.url)).headers.get('x-inkstone-root'),(await fetch(second.url)).headers.get('x-inkstone-root'));
});

test('launcher skips a legacy server even when its HTML is identical',async t=>{
  const port=await listen(t,createServer((req,res)=>res.end('<h1>Identical studio HTML</h1>')));
  const studio=await fixture(t),result=await studio.start([port,0]);
  assert.equal(result.reused,false);assert.notEqual(Number(new URL(result.url).port),port);
  assert.match(await (await fetch(result.url)).text(),/Identical studio HTML/);
});

test('launcher handles a occupied non-HTTP port without stopping its owner',async t=>{
  const server=createTcpServer(socket=>socket.destroy()),port=await listen(t,server);
  const studio=await fixture(t),result=await studio.start([port,0]);
  assert.equal(result.reused,false);assert.ok(server.listening);
});
