import { readFile, writeFile } from 'node:fs/promises';
async function main(){
  const source=(await Promise.all(['db/seeds/001_catalog.sql','db/seeds/003_tocantins.sql'].map(p=>readFile(p,'utf8')))).join('\n');
  const categories=new Map<string,string>();
  for(const row of source.matchAll(/\('([^']+)',\s*'([^']+)',\s*\d+\)/g))categories.set(row[2],row[1]);
  const entries=[...source.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)].filter(r=>categories.has(r[1])).map(r=>({categorySlug:r[1],category:categories.get(r[1])!,name:r[2],slug:r[3]}));
  await writeFile('packages/shared/src/catalog.json',JSON.stringify(entries,null,2)+'\n');
  process.stdout.write(`Catalog synchronized: ${entries.length} services, ${categories.size} categories.\n`);
}
main().catch(()=>{process.stderr.write('Could not synchronize catalog.\n');process.exitCode=1;});
