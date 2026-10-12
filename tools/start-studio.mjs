// character-studio entry point: npm start, or --open for the Windows launcher.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncCatalog } from './sync-catalog.mjs';
import { findOrStartStudio } from './lib/studio-launch.mjs';

const args = process.argv.slice(2);
if (args.some(a => a !== '--open')) throw new Error('Usage: node tools/start-studio.mjs [--open]');
if (Number(process.versions.node.split('.')[0]) < 18) throw new Error('Node.js 18 or later is required.');
await syncCatalog();

const { url, reused, child } = await findOrStartStudio(fileURLToPath(new URL('../', import.meta.url)));
console.log(`${reused ? 'This Studio is already running' : 'Inkstone Studio'}: ${url}`);
if (args.includes('--open')) {
  // URL comes only from the local server's numeric port, never shell input.
  const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', () => console.error(`Open this URL in your browser: ${url}`));
}
if (child) {
  console.log('Keep this window open. Press Ctrl+C to stop the server.');
  child.on('exit', code => { process.exitCode = code ?? 0; });
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
  process.on('exit', () => child.kill());
}
