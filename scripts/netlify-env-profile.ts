import { randomBytes } from 'node:crypto';

export type NetlifyMode = 'demo' | 'production';
export function buildNetlifyEnvironment(local: Record<string, string>, previous: Record<string, string>, mode: NetlifyMode, origin: string) {
  if (!local.DATABASE_URL) throw new Error('Configure DATABASE_URL no .env local.');
  const site = new URL(origin);
  if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
    throw new Error('Informe a origem HTTPS do site, sem caminho.');
  }
  const demo = mode === 'demo';
  // Um JWT de produção nunca é herdado pelo perfil de demonstração, ou vice-versa.
  const sameMode = previous.DEMO_MODE === String(demo);
  const schema = sameMode && previous.DATABASE_SCHEMA ? previous.DATABASE_SCHEMA : demo ? 'elo_demo' : 'elo';
  if (demo && !schema.endsWith('_demo')) throw new Error('Demonstração exige schema separado.');
  return {
    APP_URL: site.origin, WEB_ORIGIN: site.origin, DEMO_MODE: String(demo), DATABASE_MODE: 'postgres',
    DATABASE_URL: local.DATABASE_URL, DATABASE_SCHEMA: schema,
    DATABASE_SSL: 'verify-full', DATABASE_CA_FILE: 'certs/supabase-ca.crt',
    DATABASE_ASSETS_DIR: '.', DATABASE_POOL_MAX: '2', DATABASE_MIGRATE: 'false',
    DATABASE_RUNTIME_ROLE: local.DATABASE_RUNTIME_ROLE ?? 'elo_runtime',
    JWT_SECRET: sameMode && previous.JWT_SECRET ? previous.JWT_SECRET : randomBytes(48).toString('hex'),
    AWS_LAMBDA_JS_RUNTIME: 'nodejs22.x',
  };
}
