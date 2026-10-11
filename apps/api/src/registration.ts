import { hash } from 'argon2';
import type { Database, Executor } from './database';
import type { RegistrationInput, ProfessionalProfile } from '../../../packages/shared/src';
import { fail } from './errors';

export async function validateCity(tx:Executor,id:number) {
  if(!(await tx.query('SELECT id FROM cities WHERE id=$1 AND state_id=17',[id])).length)fail('CITY_INVALID','Escolha uma cidade disponível no catálogo.');
}
export async function saveProfessional(tx:Executor,id:number,input:ProfessionalProfile) {
  const services=[...new Set(input.services)],cities=[...new Set(input.cities)];
  const valid=await tx.query('SELECT s.id FROM services s JOIN categories c ON c.id=s.category_id WHERE s.id=ANY($1::bigint[]) AND s.is_active AND c.is_active',[services]);
  if(valid.length!==services.length)fail('SERVICE_INVALID','Um dos serviços não está disponível. Atualize o catálogo.');
  for(const city of cities)await validateCity(tx,city);
  await tx.query(`INSERT INTO professionals(user_id,document_type,document_number,bio) VALUES ($1,$2,$3,$4)
    ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,document_number=excluded.document_number,document_type=excluded.document_type,
    verification_status=CASE WHEN professionals.document_number=excluded.document_number THEN professionals.verification_status ELSE 'pending'::verification_status END`,[id,input.document.length===11?'cpf':'cnpj',input.document,input.bio]);
  await tx.query('INSERT INTO wallets(pro_id) VALUES ($1) ON CONFLICT(pro_id) DO NOTHING',[id]);
  await tx.query('DELETE FROM professional_services WHERE pro_id=$1',[id]);
  await tx.query('DELETE FROM professional_coverage WHERE pro_id=$1',[id]);
  for(const service of services)await tx.query('INSERT INTO professional_services(pro_id,service_id) VALUES ($1,$2)',[id,service]);
  for(const city of cities)await tx.query('INSERT INTO professional_coverage(pro_id,city_id) VALUES ($1,$2)',[id,city]);
}
export async function registerAccount(db:Database,input:RegistrationInput) {
  const passwordHash=await hash(input.password);
  try {
    return await db.transaction(async tx=>{
      await validateCity(tx,input.cityId);
      const [user]=await tx.query<{id:number}>('INSERT INTO users(role,name,email,phone,password_hash,consent_at,city_id,neighborhood) VALUES ($1,$2,$3,$4,$5,now(),$6,$7) RETURNING id',[input.role,input.name,input.email,input.phone,passwordHash,input.cityId,input.neighborhood]);
      if(input.professional)await saveProfessional(tx,Number(user.id),input.professional);
      return Number(user.id);
    });
  } catch(error) {
    if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='23505')fail('ACCOUNT_EXISTS','E-mail, telefone ou documento já cadastrado.',409);
    throw error;
  }
}
