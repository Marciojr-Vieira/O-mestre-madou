import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { Database } from '../apps/api/src/database';
import { postgresOptions, sqlIdentifier } from '../apps/api/src/postgres-options';
import { config } from '../apps/api/src/config';

test('PostgreSQL externo: migrations concorrentes, RLS e todos os fluxos HTTP e financeiros em schemas isolados', {timeout:900000}, async()=>{
  assert.ok(config.DATABASE_URL,'Preencha DATABASE_URL no .env. Chaves da API HTTP não são conexões PostgreSQL.');
  const root=`elo_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const schemas=[root,`${root}_domain`,`${root}_http`,`${root}_security`,`${root}_registration`];
  const admin=new Pool(await postgresOptions({schema:'public',runtimeRole:''}));
  const databases=[new Database('postgres','memory://',{schema:root,migrate:true,runtimeRole:''}),new Database('postgres','memory://',{schema:root,migrate:true,runtimeRole:''})];
  try {
    await Promise.all(databases.map(db=>db.initialize()));
    const [versions]=await databases[0].query('SELECT count(*) count FROM schema_migrations');assert.equal(Number(versions.count),9);
    const results=await Promise.all(['domain.test.ts','http.test.ts','database-security.test.ts','registration.test.ts'].map(async file=>{
      const environment:NodeJS.ProcessEnv={...process.env,NODE_ENV:'test',DATABASE_MODE:'postgres',DATABASE_SCHEMA:root,DATABASE_MIGRATE:'true',DATABASE_RUNTIME_ROLE:'elo_runtime',DEMO_MODE:'true',ELO_TEST_SCHEMA:root};
      // A child test runner must not inherit the parent runner's execution context.
      delete environment.NODE_TEST_CONTEXT;
      const code=await new Promise<number>(resolve=>{
        const child=spawn(process.execPath,['--import','tsx','--test',`tests/${file}`],{stdio:'inherit',windowsHide:true,
          env:environment});
        child.on('exit',status=>resolve(status??1));child.on('error',()=>resolve(1));
      });
      return {file,code};
    }));
    for(const result of results)assert.equal(result.code,0,`${result.file} falhou no PostgreSQL externo.`);
  }finally{
    await Promise.all(databases.map(db=>db.close()));
    for(const schema of schemas){
      if(!/^elo_test_[0-9]+_[a-f0-9]{8}(?:_(domain|http|security|registration))?$/.test(schema))throw new Error('Unsafe test schema cleanup');
      await admin.query(`DROP SCHEMA IF EXISTS ${sqlIdentifier(schema)} CASCADE`);
    }
    await admin.end();
  }
});
