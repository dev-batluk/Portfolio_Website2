import { spawn } from 'node:child_process';
import path from 'node:path';

const apiChild = spawn(
  process.execPath,
  ['server/index.ts', '--port', '3001', '--api-only'],
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
