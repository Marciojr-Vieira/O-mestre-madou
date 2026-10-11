import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNetlifyConfiguration } from '../apps/api/src/deployment-policy';
import { buildNetlifyEnvironment } from '../scripts/netlify-env-profile';

const demo = {
  DATABASE_MODE: 'postgres', DATABASE_URL: 'postgresql://example.invalid/postgres',
  DATABASE_SCHEMA: 'elo_demo', DATABASE_MIGRATE: 'false', DEMO_MODE: 'true', JWT_SECRET: 'd'.repeat(48),
} as const;
test('Netlify permits isolated hosted demos and real operation without quick logins', () => {
  assert.doesNotThrow(() => assertNetlifyConfiguration(demo));
  assert.doesNotThrow(() => assertNetlifyConfiguration({ ...demo, DEMO_MODE: 'false', DATABASE_SCHEMA: 'elo' }));
  for (const schema of ['elo', 'public', 'elo_demo_backup']) {
    assert.throws(() => assertNetlifyConfiguration({ ...demo, DATABASE_SCHEMA: schema }), /schema separado/);
  }
});
test('hosted demo cannot bypass durable database, JWT or migration requirements', () => {
  assert.throws(() => assertNetlifyConfiguration({ ...demo, DATABASE_MODE: 'embedded' }), /PostgreSQL/);
  assert.throws(() => assertNetlifyConfiguration({ ...demo, DATABASE_URL: undefined }), /PostgreSQL/);
  assert.throws(() => assertNetlifyConfiguration({ ...demo, JWT_SECRET: undefined }), /JWT/);
  assert.throws(() => assertNetlifyConfiguration({ ...demo, JWT_SECRET: 'short' }), /JWT/);
  assert.throws(() => assertNetlifyConfiguration({ ...demo, DATABASE_MIGRATE: 'true' }), /migrations/);
});
test('switching publication mode isolates schema and session secret; regenerating preserves sessions', () => {
  const origin = 'https://demo.example.com';
  const production = { DEMO_MODE: 'false', DATABASE_SCHEMA: 'elo', JWT_SECRET: 'p'.repeat(48) };
  const generated = buildNetlifyEnvironment(demo, production, 'demo', origin);
  assert.equal(generated.DATABASE_SCHEMA, 'elo_demo');
  assert.equal(generated.DEMO_MODE, 'true');
  assert.notEqual(generated.JWT_SECRET, production.JWT_SECRET);
  assert.equal(generated.WEB_ORIGIN, origin);
  assert.deepEqual(buildNetlifyEnvironment(demo, generated, 'demo', origin), generated);
  const real = buildNetlifyEnvironment(demo, generated, 'production', origin);
  assert.equal(real.DEMO_MODE, 'false'); assert.equal(real.DATABASE_SCHEMA, 'elo');
  assert.notEqual(real.JWT_SECRET, generated.JWT_SECRET);
  assert.throws(() => buildNetlifyEnvironment(demo, { ...generated, DATABASE_SCHEMA: 'elo' }, 'demo', origin));
  assert.throws(() => buildNetlifyEnvironment(demo, generated, 'demo', 'http://localhost:3000'));
});
