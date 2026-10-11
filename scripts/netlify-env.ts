import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { buildNetlifyEnvironment, type NetlifyMode } from './netlify-env-profile';

async function readEnvironment(file: string): Promise<Record<string, string>> {
  try { return parse(await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
async function saveEnvironment(file: string, values: Record<string, string>) {
  await writeFile(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
}
async function main() {
  const local = await readEnvironment('.env');
  const previous = await readEnvironment('NETLIFY.env');
  const args = process.argv.slice(2);
  let requestedMode: string | undefined;
  const modeIndex = args.indexOf('--mode');
  if (modeIndex >= 0) {
    requestedMode = args[modeIndex + 1];
    if (requestedMode !== 'demo' && requestedMode !== 'production') throw new Error('Modo inválido.');
    args.splice(modeIndex, 2);
  }
  if (args.length > 1) throw new Error('Informe somente uma URL.');
  const mode: NetlifyMode = requestedMode === 'demo' || requestedMode === 'production' ? requestedMode : previous.DEMO_MODE === 'false' ? 'production' : 'demo';
  const profileFile = `NETLIFY.${mode}.env`;
  const profile = await readEnvironment(profileFile);
  const sameMode = previous.DEMO_MODE === String(mode === 'demo');
  const existing = sameMode ? previous : profile;
  const origin = args[0] ?? existing.APP_URL ?? previous.APP_URL ?? 'https://SUBSTITUA-PELO-SEU-SITE.netlify.app';
  const values = buildNetlifyEnvironment(local, existing, mode, origin);
  if (previous.DEMO_MODE === 'true' || previous.DEMO_MODE === 'false') {
    await saveEnvironment(`NETLIFY.${previous.DEMO_MODE === 'true' ? 'demo' : 'production'}.env`, previous);
  }
  await saveEnvironment(profileFile, values);
  await saveEnvironment('NETLIFY.env', values);
  console.log(`NETLIFY.env gerado no modo ${mode}, schema ${values.DATABASE_SCHEMA}. Perfil preservado em ${profileFile}.`);
  console.log('Arquivo privado com segredos: importe no Netlify, sem publicar no repositório.');
  console.log('Confira APP_URL e WEB_ORIGIN com a URL efetivamente atribuída ao site.');
}
main().catch(() => { console.error('Não foi possível gerar NETLIFY.env. Confira o .env local, --mode demo|production e a URL HTTPS informada.'); process.exitCode = 1; });
