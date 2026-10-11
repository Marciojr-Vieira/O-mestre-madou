import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../apps/api/src/config';
import { assertPortAvailable, startupMessage } from '../apps/api/src/startup';
const children: ChildProcess[] = [];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;process.exitCode = code;
  // IPC requests graceful database shutdown on Windows as well as Unix.
  if (children[0]?.exitCode === null) {
    try { children[0].send({ type: 'shutdown' }); } catch { /* Child may already have exited. */ }
    for (let i = 0; i < 100 && children[0].exitCode === null; i++) await delay(100);
  }
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGTERM');
  }
  process.disconnect?.();
}
function launch(args: string[], ipc = false) {
  const child = spawn(process.execPath, args, { stdio: ipc ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit', windowsHide: true, env: {...process.env,ELO_API_PORT:String(config.PORT)} });
  children.push(child);
  child.on('error', () => { console.error('Não foi possível iniciar um processo do projeto.'); void stop(1); });
  child.on('exit', code => { if (!stopping) void stop(code ?? 1); });
  return child;
}
async function run() {
  const webPort = Number(new URL(config.WEB_ORIGIN).port || 3000);
  await assertPortAvailable(webPort);await assertPortAvailable(config.PORT);
  const api = launch(['--import', 'tsx', 'apps/api/src/main.ts'], true);
  let ready = false;
  api.on('message', message => { if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'ready') ready = true; });
  // The first remote demo seed may need more than a minute over the pooler.
  for (let i = 0; i < 1800 && !ready && !stopping; i++) await delay(100);
  if (stopping) return;
  if (!ready) throw Object.assign(new Error('API readiness timeout'),{code:'API_START_TIMEOUT'});
  launch([resolve('node_modules/next/dist/bin/next'), 'dev', 'apps/web', '--port', String(webPort)]);
}
process.on('SIGINT', () => { void stop(); });process.on('SIGTERM', () => { void stop(); });
process.on('message', message => {
  if(typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') void stop();
});
run().catch(error => { console.error(startupMessage(error)); void stop(1); });
