import { readFile, readdir, realpath, rm, lstat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';

const manifestSchema=z.object({dependencies:z.record(z.string(),z.string()).optional(),optionalDependencies:z.record(z.string(),z.string()).optional(),peerDependencies:z.record(z.string(),z.string()).optional()});
const artifact=resolve('.netlify-api/runtime');
const modules=join(artifact,'node_modules');
const keptPackages=new Set<string>();
const keptInstances=new Set<string>();
async function findDependency(from:string,name:string):Promise<string|undefined>{
  for(let directory=from;directory.startsWith(artifact);directory=dirname(directory)){
    try{return await realpath(join(directory,'node_modules',name));}catch{/* Search parent scope. */}
    if(directory===artifact)break;
  }
}
async function visit(directory:string){
  const actual=await realpath(directory);
  if(!actual.startsWith(artifact+sep))throw new Error('Dependência fora do pacote isolado.');
  if(keptPackages.has(actual))return;
  keptPackages.add(actual);
  const segments=relative(modules,actual).split(sep);
  if(segments[0]==='.pnpm')keptInstances.add(segments[1]);
  const manifest=manifestSchema.parse(JSON.parse(await readFile(join(actual,'package.json'),'utf8')));
  for(const [name] of Object.entries({...manifest.dependencies,...manifest.optionalDependencies,...manifest.peerDependencies})){
    const dependency=await findDependency(actual,name);
    if(dependency)await visit(dependency);
    else if(manifest.dependencies?.[name])throw new Error('Dependência obrigatória ausente do pacote da API.');
  }
}
async function pruneModules(directory:string){
  let entries;
  try{entries=await readdir(directory,{withFileTypes:true});}catch{return;}
  for(const entry of entries){
    if(entry.name==='.pnpm'||entry.name==='.bin')continue;
    const target=join(directory,entry.name);
    if(entry.name.startsWith('@')&&entry.isDirectory()){await pruneModules(target);continue;}
    const metadata=await lstat(target);
    if(metadata.isSymbolicLink()||metadata.isDirectory()){
      let keep=false;try{keep=keptPackages.has(await realpath(target));}catch{/* Broken optional link. */}
      if(!keep)await rm(target,{recursive:!metadata.isSymbolicLink(),force:true});
    }
  }
}
async function main(){
  const manifest=manifestSchema.parse(JSON.parse(await readFile(join(artifact,'package.json'),'utf8')));
  for(const name of Object.keys(manifest.dependencies??{})){
    const dependency=await findDependency(artifact,name);
    if(!dependency)throw new Error('Dependência da API ausente.');
    await visit(dependency);
  }
  const store=join(modules,'.pnpm');
  const instances=await readdir(store,{withFileTypes:true}).catch(()=>[]);
  for(const entry of instances){
    if(entry.isDirectory()&&entry.name!=='node_modules'&&!keptInstances.has(entry.name))await rm(join(store,entry.name),{recursive:true,force:true});
  }
  await pruneModules(modules);
  await pruneModules(join(store,'node_modules'));
  for(const directory of keptPackages)await pruneModules(join(directory,'node_modules'));
  console.log(`Pacote da API limitado a ${keptPackages.size} dependências necessárias, sem o frontend ou ferramentas locais.`);
}
main().catch(()=>{console.error('Não foi possível conferir as dependências isoladas da API.');process.exitCode=1;});
