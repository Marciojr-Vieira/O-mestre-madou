import { PGlite } from '@electric-sql/pglite';
import { Pool, type PoolClient, type QueryResult } from 'pg';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config';
import { lockDatabase } from './database-lock';
import { postgresOptions, sqlIdentifier, type DatabaseOptions } from './postgres-options';
export type Row = Record<string, unknown>;
export interface Executor { query<T extends Row = Row>(text: string, values?: unknown[]): Promise<T[]> }
function rows<R extends Row>(result: QueryResult<R> | QueryResult<R>[]): R[] { return Array.isArray(result) ? result.at(-1)?.rows ?? [] : result.rows; }
export class Database implements Executor {
  private pool?: Pool;
  private embedded?: PGlite;
  private tail: Promise<void> = Promise.resolve();
  private releaseLock?: () => Promise<void>;
  constructor(private mode: 'embedded' | 'postgres' = config.DATABASE_MODE, private directory = config.DATA_DIR, private options: DatabaseOptions = {}) {}
  async initialize() {
    if (this.mode === 'postgres') {
      const migrate=this.options.migrate ?? config.DATABASE_MIGRATE==='true';
      this.pool = new Pool(await postgresOptions(this.options,!migrate));
      this.pool.on('error',()=>{ /* Request/startup handlers report safe errors; never print credentials. */ });
      const client=await this.pool.connect();
      const schema=this.options.schema ?? config.DATABASE_SCHEMA;
      try {
        if(migrate){
          await client.query('SELECT pg_advisory_lock(hashtext($1),hashtext($2))',['elo-migrations',schema]);
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${sqlIdentifier(schema)}`);
          await client.query('CREATE SCHEMA IF NOT EXISTS extensions');
          await client.query('CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions');
          await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions');
          await client.query(`SET search_path TO ${sqlIdentifier(schema)}, extensions, public`);
          await this.migrate({ query:async <R extends Row>(sql:string,values:unknown[]=[])=>rows<R>(await client.query<R>(sql,values)) },async work=>{
            await client.query('BEGIN');
            try{await work();await client.query('COMMIT');}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
          });
        }else{
          const versions=await client.query<{name:string}>(`SELECT name FROM ${sqlIdentifier(schema)}.schema_migrations`);
          for(const directory of ['db/migrations','db/seeds'])for(const name of (await readdir(resolve(config.DATABASE_ASSETS_DIR,directory))).filter(n=>n.endsWith('.sql'))){
            if(!versions.rows.some(v=>v.name===`${directory}/${name}`))throw Object.assign(new Error('Pending database migrations'),{code:'MIGRATIONS_PENDING'});
          }
        }
      } finally {
        if(migrate)await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))',['elo-migrations',schema]).catch(()=>{});
        client.release();
      }
      if(migrate && (this.options.runtimeRole ?? config.DATABASE_RUNTIME_ROLE)){
        await this.pool.end();this.pool=new Pool(await postgresOptions(this.options,true));
        this.pool.on('error',()=>{});
      }
      await this.query('SELECT 1');return;
    }
    else { if (this.directory !== 'memory://') { await mkdir(this.directory, { recursive: true }); this.releaseLock = await lockDatabase(this.directory); } this.embedded = new PGlite(this.directory); await this.embedded.waitReady; }
    await this.migrate(this,work=>this.transaction(async()=>work()));
  }
  private async migrate(executor: Executor, transaction: (work:()=>Promise<void>)=>Promise<void>) {
    await executor.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
    for (const directory of ['db/migrations', 'db/seeds']) {
      for (const name of (await readdir(resolve(config.DATABASE_ASSETS_DIR,directory))).filter(n => n.endsWith('.sql')).sort()) {
        const key = `${directory}/${name}`;
        if ((await executor.query('SELECT name FROM schema_migrations WHERE name=$1', [key])).length) continue;
        let source = await readFile(resolve(config.DATABASE_ASSETS_DIR,key), 'utf8');
        if (this.embedded) source = source.replace(/CREATE EXTENSION IF NOT EXISTS (citext|pg_trgm);/g, '').replace(/CITEXT/g, 'TEXT').replace(/CREATE INDEX \w+ ON \w+ USING gin \([^;]+;/g, '');
        if(this.embedded)await this.transaction(async tx=>{await tx.query(source);await tx.query('INSERT INTO schema_migrations VALUES ($1)',[key]);});
        else await transaction(async()=>{await executor.query(source);await executor.query('INSERT INTO schema_migrations VALUES ($1)',[key]);});
      }
    }
  }
  async query<T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> {
    if (this.pool) return rows<T>(await this.pool.query<T>(text, values));
    if (!this.embedded) throw new Error('Database is not initialized');
    return this.exclusive(async () => {
      if (values.length === 0 && text.includes(';')) { await this.embedded!.exec(text); return []; }
      return (await this.embedded!.query<T>(text, values)).rows;
    });
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.tail; let release: () => void = () => {};
    this.tail = new Promise<void>(r => { release = r; });
    await previous; try { return await work(); } finally { release(); }
  }
  async transaction<T>(work: (tx: Executor) => Promise<T>): Promise<T> {
    if (this.pool) {
      const client: PoolClient = await this.pool.connect();
      try { await client.query('BEGIN'); const result = await work({ query: async <R extends Row>(sql: string, values: unknown[] = []) => rows<R>(await client.query<R>(sql,values)) }); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK').catch(()=>{}); throw error; } finally { client.release(); }
    }
    return this.exclusive(() => this.embedded!.transaction(tx => work({ query: async <R extends Row>(text: string, values: unknown[] = []) => {
      if (!values.length && text.includes(';')) { await tx.exec(text); return []; }
      return (await tx.query<R>(text, values)).rows;
    } })));
  }
  async close() {
    const pool=this.pool, embedded=this.embedded, release=this.releaseLock;
    this.pool=undefined;this.embedded=undefined;this.releaseLock=undefined;
    try { await pool?.end();if(embedded && !embedded.closed) await embedded.close(); }
    finally { await release?.(); }
  }
  async onApplicationShutdown() { await this.close(); }
}
