import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const tscBin = path.join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const buildRes = spawnSync(process.execPath, [tscBin, '-p', 'tsconfig.server.json'], {
  stdio: 'inherit',
});
if (buildRes.status !== 0) {
  process.exit(buildRes.status ?? 1);
}

const apiChild = spawn(
  process.execPath,
  ['dist-server/server/index.js', '--port', '3001', '--api-only'],
  { stdio: 'inherit' },
);

const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const webChild = spawn(process.execPath, [viteBin], { stdio: 'inherit' });

function shutdown(signal: NodeJS.Signals) {
  apiChild.kill(signal);
  webChild.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

apiChild.on('exit', (code) => {
  if (code && code !== 0) {
    webChild.kill();
    process.exit(code);
  }
});

webChild.on('exit', (code) => {
  apiChild.kill();
  process.exit(code ?? 0);
});
