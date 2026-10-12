import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

/** Reuse only a server serving this checkout; never stop an unrelated server. */
export async function findOrStartStudio(root, { ports = Array.from({ length: 10 }, (_, i) => 8081 + i) } = {}) {
  const realRoot = await realpath(root);
  const rootId = createHash('sha256').update(process.platform === 'win32' ? realRoot.toLowerCase() : realRoot).digest('hex');
  for (const port of ports) {
    const url = `http://127.0.0.1:${port}/`;
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(800) });
      if (response.ok && response.headers.get('x-inkstone-root') === rootId) return { url, reused: true, child: null };
      continue;
    } catch { /* Attempt a real bind; this also safely handles probe races. */ }
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(realRoot, 'tools/serve.mjs'), String(port)], {
        cwd: realRoot, windowsHide: true, stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      });
      let stderr = '', busy = false;
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.stdout.on('data', () => {});
      child.on('error', reject);
      child.on('message', message => {
        if (message.type === 'busy') busy = true;
        if (message.type === 'ready') resolve({ url: `http://127.0.0.1:${message.port}/`, reused: false, child });
      });
      child.on('exit', code => {
        if (busy) resolve(null);
        else reject(new Error(stderr.trim() || `Studio server exited before startup (${code})`));
      });
    });
    if (result) return result;
  }
  throw new Error('No available Studio port (8081–8090). Close an unused local server and retry.');
}
