import { readFile } from 'node:fs/promises';
import { types, type PoolConfig } from 'pg';
import { config } from './config';

export type DatabaseOptions = { connectionString?: string; schema?: string; runtimeRole?: string; migrate?: boolean; ssl?: 'disable' | 'verify-full'; caFile?: string; poolMax?: number };
export function postgresInteger(value: string) {
  const number=Number(value);
  if(!Number.isSafeInteger(number))throw new Error('Inteiro PostgreSQL fora do limite seguro da API.');
  return number;
}
export function sqlIdentifier(value: string) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error('Identificador de banco inválido.');
  return `"${value}"`;
}
export async function postgresOptions(options: DatabaseOptions, runtime = false): Promise<PoolConfig> {
  const source=options.connectionString ?? config.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL é obrigatória no modo PostgreSQL.');
  let url: URL;
  try { url=new URL(source); } catch { throw new Error('DATABASE_URL inválida. Use uma URI PostgreSQL do painel Connect.'); }
  if (!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL deve ser uma URI PostgreSQL, não a URL da API HTTP.');
  const sslMode=options.ssl ?? config.DATABASE_SSL;
  const managed=/\.supabase\.(com|co)$/.test(url.hostname);
  const sslRequested=managed || sslMode==='verify-full' || (url.searchParams.has('sslmode') && url.searchParams.get('sslmode')!=='disable');
  const caFile=options.caFile ?? config.DATABASE_CA_FILE;
  // pg connection-string SSL fields override ssl options. Keep verification explicit.
  for (const parameter of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(parameter);
  const schema=options.schema ?? config.DATABASE_SCHEMA;
  sqlIdentifier(schema);
  const role=runtime ? options.runtimeRole ?? config.DATABASE_RUNTIME_ROLE : undefined;
  if(role)sqlIdentifier(role);
  return { connectionString:url.toString(),ssl:sslRequested ? {rejectUnauthorized:true,...(caFile?{ca:await readFile(caFile,'utf8')}:{})}:false,
    types:{getTypeParser:(oid,format)=>oid===20 && (!format || format==='text') ? postgresInteger : types.getTypeParser(oid,format)},
    onConnect:async client=>{
      // Poolers may ignore startup parameters. Configure every physical connection
      // before pg-pool makes it available, including replacements after errors.
      await client.query(`SET search_path TO ${sqlIdentifier(schema)}, extensions, public; SET statement_timeout TO 15000; SET application_name TO 'elo-api'${role?`; SET ROLE ${sqlIdentifier(role)}`:''}`);
      if(role){
        const result=await client.query<{name:string}>('SELECT current_user name');
        if(result.rows[0]?.name!==role)throw Object.assign(new Error('Runtime role was not applied'),{code:'DATABASE_ROLE_UNSAFE'});
      }
    },
    max:options.poolMax ?? config.DATABASE_POOL_MAX,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,
    application_name:'elo-api',options:`-c search_path=${schema},extensions,public -c statement_timeout=15000` };
}
