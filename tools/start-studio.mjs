// character-studio entry point: npm start, or --open for the Windows launcher.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { syncCatalog } from './sync-catalog.mjs';

const args = process.argv.slice(2);
if (args.some(a => a !== '--open')) throw new Error('Usage: node tools/start-studio.mjs [--open]');
const shouldOpen = args.includes('--open');
const url = 'http://127.0.0.1:8081/';
const root = fileURLToPath(new URL('../', import.meta.url));
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error('Node.js 18 or later is required.');
  process.exit(1);
}
await syncCatalog();

function openBrowser() {
  if (!shouldOpen) return;
  // Fixed URL: no user-provided text is passed to the command shell.
  const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
    windowsHide: true, stdio: 'ignore',
  });
  browser.on('error', () => console.error(`Open this URL in your browser: ${url}`));
}

// Reuse this studio if it is already being served on the default port.
let alreadyRunning = false;
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
  alreadyRunning = response.ok && (await response.text()) ===
    await readFile(new URL('../index.html', import.meta.url), 'utf8');
} catch { /* No matching server: start the existing repository server below. */ }

if (alreadyRunning) {
  console.log(`Inkstone is already running: ${url}`);
  openBrowser();
} else {
  const server = spawn(process.execPath, ['tools/serve.mjs', '8081'], {
    cwd: root, stdio: ['inherit', 'pipe', 'inherit'],
  });
  let output = '', opened = false;
  server.stdout.on('data', chunk => {
    process.stdout.write(chunk);
    output += chunk.toString();
    if (!opened && output.includes('Inkstone: http://localhost:8081/')) {
      opened = true;
      console.log('Keep this window open. Press Ctrl+C to stop the server.');
      openBrowser();
    }
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.on('exit', code => { process.exitCode = code ?? 0; });
  process.on('SIGINT', () => server.kill());
  process.on('SIGTERM', () => server.kill());
}
