import { z } from 'zod';
import { Database } from '../apps/api/src/database';
import { Marketplace } from '../apps/api/src/domain';
import { config } from '../apps/api/src/config';
async function main() {
  const enabled=z.enum(['on','off']).parse(process.argv[2])==='on';
  if(config.DEMO_MODE!=='true'||!config.DATABASE_SCHEMA.endsWith('_demo'))throw new Error('Este comando exige um schema separado de demonstração.');
  const db=new Database();
  try {
    await db.initialize();
    await db.transaction(async tx=>{
      const [actor]=await tx.query("SELECT id FROM users WHERE role='admin' AND status='active' ORDER BY id LIMIT 1");
      if(!actor)throw new Error('Inicie a demonstração antes de usar este comando.');
      await tx.query('UPDATE application_settings SET demo_login_enabled=$1,updated_at=now(),updated_by=$2 WHERE singleton=true',[enabled,actor.id]);
      await new Marketplace(db).audit(tx,Number(actor.id),'demo.login.toggle','application_settings',1,{enabled,source:'local-owner-command'});
    });
    console.log(enabled?'Acessos rápidos de demonstração ativados.':'Acessos rápidos de demonstração desativados.');
  }finally{await db.close();}
}
main().catch(()=>{console.error('Confira o ambiente de demonstração e use demo-access on ou demo-access off. Produção não aceita esse comando.');process.exitCode=1;});
