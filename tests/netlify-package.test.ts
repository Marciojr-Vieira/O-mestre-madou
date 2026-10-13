import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const execute = promisify(execFile);

test('Netlify preparation replaces the old ESM wrapper with a loadable Lambda CommonJS entry', async () => {
  const project = resolve('.');
  const directory = await mkdtemp(join(tmpdir(), 'elo-netlify-package-'));
  try {
    for (const path of ['config/certs', 'db', '.netlify-api/apps', '.netlify-api/packages', '.netlify-api/netlify/functions', '.netlify-api/functions']) {
      await mkdir(join(directory, path), { recursive: true });
    }
    await writeFile(join(directory, 'config/certs/supabase-ca.crt'), 'fixture');
    await writeFile(join(directory, '.netlify-api/netlify/functions/api.js'), "exports.handler = async () => ({ statusCode: 200, body: 'ok' });\n");
    await writeFile(join(directory, '.netlify-api/functions/api.mjs'), "export const handler = () => {};\n");
    await execute(process.execPath, [join(project, 'node_modules/tsx/dist/cli.mjs'), join(project, 'scripts/prepare-netlify.ts')], { cwd: directory });
    await assert.rejects(access(join(directory, '.netlify-api/functions/api.mjs')));

    // The bundler places a legacy Lambda entry at the root of the ZIP. Loading
    // this entry also checks the relative path into the isolated runtime.
    await writeFile(join(directory, '.netlify-api/api.js'), "module.exports = require('./functions/api.cjs');\n");
    const { stdout } = await execute(process.execPath, ['-e', "require('./api.js').handler().then(result => process.stdout.write(JSON.stringify(result)))"], { cwd: join(directory, '.netlify-api') });
    assert.deepEqual(JSON.parse(stdout), { statusCode: 200, body: 'ok' });
    assert.equal(await readFile(join(directory, '.netlify-api/certs/supabase-ca.crt'), 'utf8'), 'fixture');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
