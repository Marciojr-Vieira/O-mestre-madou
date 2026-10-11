import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { assertPortAvailable, startupMessage } from '../apps/api/src/startup';
import { Database } from '../apps/api/src/database';
import { lockDatabase } from '../apps/api/src/database-lock';
async function clean(directory: string) {
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test cleanup');
  await rm(directory,{recursive:true,force:true});
}

test('startup diagnoses occupied ports before opening the database and hides credentials', async () => {
  const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await assert.rejects(assertPortAvailable((server.address() as AddressInfo).port), {code:'EADDRINUSE'}); }
  finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
  assert.match(startupMessage({code:'EADDRINUSE'}),/Porta ocupada/);
  assert.match(startupMessage(new Error('Aborted()')),/WAL/);
  assert.equal(startupMessage(new Error('postgres://secret:password@host')),startupMessage(new Error('other')));
});
test('persistent database rejects a second owner and survives clean shutdown and reopen', async () => {
  const directory=await mkdtemp(join(tmpdir(),'elo-db-'));
  const first=new Database('embedded',join(directory,'database')),second=new Database('embedded',join(directory,'database'));
  try {
    await first.initialize();
    await assert.rejects(second.initialize(),{code:'DATABASE_LOCKED'});
    await first.query('CREATE TABLE restart_probe (id integer PRIMARY KEY)');
    await first.query('INSERT INTO restart_probe VALUES (7)');
    await first.close();await first.close();
    await second.initialize();assert.equal((await second.query('SELECT id FROM restart_probe'))[0].id,7);
  } finally { await first.close();await second.close();await clean(directory); }
});
test('malformed locks are preserved and stale locks are reclaimed only for dead owners', async () => {
  const directory=await mkdtemp(join(tmpdir(),'elo-lock-'));
  try {
    const database=join(directory,'database');
    await writeFile(`${database}.elo.lock`,'invalid');
    await assert.rejects(lockDatabase(database),{code:'DATABASE_LOCKED'});
    await writeFile(`${database}.elo.lock`,JSON.stringify({pid:2147483647}));
    const release=await lockDatabase(database);await release();
  } finally { await clean(directory); }
});
