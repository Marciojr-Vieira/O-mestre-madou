import { cp, mkdir, access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

async function main() {
  await access('config/certs/supabase-ca.crt',constants.R_OK);
  await mkdir('.netlify-api/certs',{recursive:true});
  await cp('config/certs/supabase-ca.crt','.netlify-api/certs/supabase-ca.crt');
  await cp('db','.netlify-api/db',{recursive:true});
  await cp('.netlify-api/apps','.netlify-api/runtime/apps',{recursive:true});
  await cp('.netlify-api/packages','.netlify-api/runtime/packages',{recursive:true});
  await cp('.netlify-api/netlify','.netlify-api/runtime/netlify',{recursive:true});
  await mkdir('.netlify-api/functions',{recursive:true});
  await writeFile('.netlify-api/functions/api.mjs',`export { handler } from '../runtime/netlify/functions/api.js';\nexport const config = { nodeBundler: 'none', includedFiles: ['.netlify-api/runtime/**', '.netlify-api/db/**', '.netlify-api/certs/**'] };\n`);
  console.log('API compilada, migrations e certificado preparados para Netlify.');
}
main().catch(()=>{console.error('Não foi possível preparar os arquivos do Netlify.');process.exitCode=1;});
