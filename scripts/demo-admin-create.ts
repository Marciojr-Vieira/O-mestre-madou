import { randomBytes } from 'node:crypto';
import { hash } from 'argon2';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { Database } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';

async function main() {
  if (config.DATABASE_MODE !== 'postgres' || config.DEMO_MODE !== 'true' || !config.DATABASE_SCHEMA.endsWith('_demo')) throw new Error('Use somente um schema PostgreSQL de demonstração.');
  const email = z.email().parse(process.argv[2]).toLowerCase();
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await hash(password);
  const db = new Database();
  await mkdir('.data', { recursive: true });
  const credentialsFile = `.data/ACESSO-ADM-${config.DATABASE_SCHEMA}.txt`;
  try {
    await db.initialize();
    await db.transaction(async tx => {
      if ((await tx.query('SELECT 1 FROM users WHERE email=$1', [email])).length) throw new Error('Conta já existe; senha preservada.');
      const [user] = await tx.query<{ id: number }>(`INSERT INTO users(role,name,email,phone,password_hash,consent_at,city_id) VALUES ('admin','Administrador O Mestre Mandou',$1,$2,$3,now(),1721000) RETURNING id`, [email, '+5563000000999', passwordHash]);
      await tx.query(`INSERT INTO audit_logs(actor_id,action,entity,entity_id,diff) VALUES ($1,'account.admin.bootstrap','user',$1,$2)`, [user.id, JSON.stringify({ source: 'owner-command', demo: true })]);
      // Save the owner's credentials before commit; a disk failure rolls back the account.
      await writeFile(credentialsFile, `O Mestre Mandou — acesso administrativo da demonstração\nSite: https://o-mestre-mandou.netlify.app\nE-mail: ${email}\nSenha: ${password}\nSchema: ${config.DATABASE_SCHEMA}\n\nArquivo privado. Não enviar ao GitHub nem importar nas variáveis do Netlify.\n`, { flag: 'wx', mode: 0o600 });
    });
    console.log(`ADM criado. Credenciais salvas somente em ${credentialsFile}.`);
  } finally { await db.close(); }
}
main().catch(() => { console.error('Não foi possível criar o ADM. Confira o e-mail, o schema de demonstração e a ausência de conta/arquivo anteriores.'); process.exitCode = 1; });
