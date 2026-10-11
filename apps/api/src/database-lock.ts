import { open, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
function busy(): never { throw Object.assign(new Error('Embedded database is already in use'), { code: 'DATABASE_LOCKED' }); }
function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH'); }
}
function owner(source: string) {
  try { const parsed: unknown = JSON.parse(source); if (typeof parsed === 'object' && parsed !== null && 'pid' in parsed && typeof parsed.pid === 'number' && Number.isSafeInteger(parsed.pid) && parsed.pid > 0) return parsed.pid; } catch { /* Malformed locks require manual inspection. */ }
  return null;
}
export async function lockDatabase(directory: string) {
  const path = `${resolve(directory)}.elo.lock`;
  const content = JSON.stringify({ pid: process.pid, token: randomUUID() });
  async function acquire() {
    const file = await open(path, 'wx');
    try { await file.writeFile(content); } finally { await file.close(); }
  }
  try { await acquire(); }
  catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST')) throw error;
    const reaperPath = `${resolve(directory)}.elo.reap.lock`;
    const reaper = await open(reaperPath, 'wx').catch(() => busy());
    try {
      const source = await readFile(path, 'utf8').catch(() => '');
      const pid = owner(source);
      if (!pid || alive(pid)) busy();
      await unlink(path);
      await acquire();
    } finally { await reaper.close(); await unlink(reaperPath); }
  }
  return async () => {
    if (await readFile(path, 'utf8').catch(() => '') === content) await unlink(path);
  };
}
