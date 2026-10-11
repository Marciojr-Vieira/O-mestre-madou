import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postgresOptions, postgresInteger, sqlIdentifier } from '../apps/api/src/postgres-options';
import { startupMessage } from '../apps/api/src/startup';

test('Supabase connections verify TLS even when URI requests weaker SSL',async()=>{
  const options=await postgresOptions({connectionString:'postgresql://test:test@aws-0-example.pooler.supabase.com:5432/postgres?sslmode=disable',schema:'elo',runtimeRole:'elo_runtime',ssl:'disable',caFile:''},true);
  assert.deepEqual(options.ssl,{rejectUnauthorized:true});
  assert.ok(!options.connectionString?.includes('sslmode'));
  assert.match(options.options??'',/search_path=elo,extensions,public/);
  assert.equal(typeof options.onConnect,'function');
  assert.doesNotMatch((await postgresOptions({connectionString:'postgresql://test:test@localhost:5432/elo',schema:'elo',runtimeRole:'elo_runtime'})).options??'',/role=/);
});

test('PostgreSQL bigint identifiers preserve the numeric API contract without rounding',()=>{
  assert.equal(postgresInteger('1721000'),1721000);
  assert.equal(postgresInteger('9007199254740991'),Number.MAX_SAFE_INTEGER);
  assert.throws(()=>postgresInteger('9007199254740993'),/limite seguro/);
});

test('configuration rejects HTTP URLs and unsafe schema identifiers without exposing credentials',async()=>{
  await assert.rejects(postgresOptions({connectionString:'https://example.supabase.co'}),/URI PostgreSQL/);
  assert.throws(()=>sqlIdentifier('elo;DROP SCHEMA public'),/inválido/);
  assert.match(startupMessage({code:'ENETUNREACH'}),/Session pooler/);
  assert.match(startupMessage(new Error('Connection terminated due to connection timeout')),/Session pooler/);
});
