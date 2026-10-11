import { z } from 'zod';
import { Database } from '../apps/api/src/database';
import { Marketplace } from '../apps/api/src/domain';
import { fail } from '../apps/api/src/errors';
async function main() {
  const email=z.email().transform(value=>value.toLowerCase()).parse(process.argv[2]??process.env.ADMIN_EMAIL);
  if(email.endsWith('@demo.elo.invalid'))throw new Error('Use uma conta real, cadastrada com senha.');
  const db=new Database();
  try {
    await db.initialize();
    await db.transaction(async tx=>{
      const [user]=await tx.query("SELECT id,role FROM users WHERE email=$1 AND status='active' FOR UPDATE",[email]);
      if(!user)fail('ACCOUNT_REQUIRED','Cadastre primeiro uma conta de cliente com e-mail e senha.');
      if(user.role==='pro')fail('ROLE_INVALID','Use uma conta de cliente dedicada à administração.');
      if(user.role==='admin')return;
      await tx.query("UPDATE users SET role='admin',updated_at=now() WHERE id=$1",[user.id]);
      await tx.query('DELETE FROM refresh_sessions WHERE user_id=$1',[user.id]);
      await new Marketplace(db).audit(tx,Number(user.id),'account.admin.bootstrap','user',Number(user.id),{source:'local-owner-command'});
    });
    console.log('Perfil administrativo habilitado. Entre novamente com e-mail e senha.');
  }finally{await db.close();}
}
main().catch(()=>{console.error('Não foi possível habilitar o ADM. Confira o e-mail de uma conta de cliente ativa e a configuração do banco.');process.exitCode=1;});
