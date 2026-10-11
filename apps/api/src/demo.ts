import { hash } from 'argon2';
import { randomBytes } from 'node:crypto';
import type { Database } from './database';
import { Marketplace } from './domain';
function demoDocument(index:number) {
  let value=String(index).padStart(9,'0');
  for(const length of [9,10]){
    const sum=[...value].reduce((total,digit,position)=>total+Number(digit)*(length+1-position),0);
    value+=String((sum*10%11)%10);
  }
  return value;
}
export async function seedDemo(db: Database) {
  if ((await db.query("SELECT id FROM users WHERE email='cliente@demo.elo.invalid'")).length) return;
  const password = await hash(randomBytes(48).toString('hex'));
  const roles = ['client','pro','admin','pro','pro','pro','pro','pro'];
  const names = ['Cliente de demonstração','Profissional de demonstração','Admin de demonstração','Profissional teste 2','Profissional teste 3','Profissional teste 4','Profissional teste 5','Profissional teste 6'];
  const emails = ['cliente','profissional','admin','pro2','pro3','pro4','pro5','pro6'];
  const ids: number[] = [];
  await db.transaction(async tx => {
    for (let i=0;i<roles.length;i++) {
      const [user] = await tx.query<{ id: number }>(`INSERT INTO users(role,name,email,phone,password_hash,phone_verified_at,consent_at) VALUES ($1,$2,$3,$4,$5,now(),now()) RETURNING id`, [roles[i], names[i], `${emails[i]}@demo.elo.invalid`, `+556300000000${i}`, password]);
      ids.push(Number(user.id));
      if (roles[i] === 'pro') {
        await tx.query("INSERT INTO professionals(user_id,document_type,document_number,bio,verification_status) VALUES ($1,'cpf',$2,'Perfil fictício para testar o funcionamento do marketplace.','verified')", [user.id, demoDocument(i)]);
        await tx.query('INSERT INTO professional_services(pro_id,service_id) SELECT $1,id FROM services', [user.id]);
        await tx.query('INSERT INTO professional_coverage VALUES ($1,1721000)', [user.id]);
        await tx.query("INSERT INTO coin_transactions(pro_id,type,amount,idempotency_key) VALUES ($1,'bonus',60,$2)", [user.id, `demo-bonus:${user.id}`]);
      }
    }
  });
  const descriptions = [
    ['diarista','Preciso de uma limpeza completa em um apartamento de dois quartos. Tenho os produtos de limpeza.'],
    ['eletricista','Preciso instalar duas tomadas na sala e verificar um disjuntor que está desarmando.'],
    ['encanador','A pia da cozinha está vazando no sifão. Preciso avaliar o reparo e trocar a peça se necessário.'],
    ['pintor','Quero pintar a sala e os dois quartos de um apartamento. As paredes estão em bom estado.'],
    ['ar-condicionado','Preciso de limpeza preventiva em dois aparelhos split e revisão dos filtros.'],
    ['montador-de-moveis','Preciso montar um guarda-roupa novo com seis portas e uma cômoda.']
  ];
  const marketplace = new Marketplace(db);
  for (const [slug, description] of descriptions) {
    const [service] = await db.query('SELECT id FROM services WHERE slug=$1 LIMIT 1', [slug]);
    const [request] = await db.query<{ id: number }>("INSERT INTO requests(client_id,service_id,city_id,description,urgency,expires_at) VALUES ($1,$2,1721000,$3,'this_week',now()+interval '7 days') RETURNING id", [ids[0], service.id, description]);
    const questions = await db.query('SELECT id,options FROM service_questions WHERE service_id=$1', [service.id]);
    for (const question of questions) await db.query('INSERT INTO request_answers(request_id,question_id,value) VALUES ($1,$2,$3)', [request.id, question.id, JSON.stringify((question.options as string[])[0])]);
    await marketplace.match(Number(request.id));
  }
}
