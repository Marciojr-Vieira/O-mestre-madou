import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Database, type Executor, type Row } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';
import { sqlIdentifier } from '../apps/api/src/postgres-options';
import { startupMessage } from '../apps/api/src/startup';

const origin='pglite-recovered-20261007';
const sourcePath='.data/local-import-20261008.json';
const maps=new Map<string,Map<number,number>>();
function remember(table:string,oldId:unknown,newId:unknown){const values=maps.get(table)??new Map<number,number>();values.set(Number(oldId),Number(newId));maps.set(table,values);}
function mapped(table:string,id:unknown){if(id===null || id===undefined)return id;const value=maps.get(table)?.get(Number(id));if(value===undefined)throw new Error(`Referência local sem correspondência em ${table}.`);return value;}
function key(value:unknown){return typeof value==='string'?value.replace(/^unlock:(\d+):/,(_,id:string)=>`unlock:${mapped('users',id)}:`):value;}
function payload(value:unknown):unknown {
  if(Array.isArray(value))return value.map(payload);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,({requestId:'requests',proId:'users',leadId:'leads',paymentId:'payments'} as Record<string,string>)[name] && item!==null ? mapped(({requestId:'requests',proId:'users',leadId:'leads',paymentId:'payments'} as Record<string,string>)[name],item):payload(item)]));
  return value;
}
async function run(){
  if(config.DATABASE_MODE!=='postgres' || config.DATABASE_SCHEMA!=='elo' || !new URL(config.DATABASE_URL!).username.endsWith('.catfliwcaezqtgakaxwa'))throw new Error('Importação exige o projeto Supabase confirmado e schema elo.');
  const source=z.record(z.string(),z.array(z.record(z.string(),z.unknown()))).parse(JSON.parse(await readFile(sourcePath,'utf8')));
  const digest=createHash('sha256').update(JSON.stringify(source)).digest('hex');
  for(const wallet of source.wallets){const sum=source.coin_transactions.filter(row=>row.pro_id===wallet.pro_id).reduce((total,row)=>total+Number(row.amount),0);if(sum!==Number(wallet.balance))throw new Error('Ledger local divergente.');}
  for(const request of source.requests){const leadIds=new Set(source.leads.filter(row=>row.request_id===request.id).map(row=>row.id));if(source.coin_transactions.filter(row=>row.type==='unlock' && leadIds.has(row.lead_id)).length!==Number(request.unlocked_count))throw new Error('Slots locais divergentes.');}
  // These tables are empty in this snapshot. Fail rather than omit new records.
  for(const table of ['payments','refund_requests','reviews','reports','request_attachments','fixed_price_offers','phone_challenges','audit_logs'])if(source[table].length)throw new Error(`Snapshot contém ${table}; exige mapeamento adicional antes da importação.`);
  const db=new Database('postgres',config.DATA_DIR,{migrate:false,runtimeRole:''});
  try{
    await db.initialize();
    const result=await db.transaction(async tx=>{
      await tx.query("SET LOCAL statement_timeout='5min'");
      await tx.query('SELECT pg_advisory_xact_lock(hashtext(current_schema()),hashtext($1))',[origin]);
      const previous=(await tx.query("SELECT diff FROM audit_logs WHERE action='database.local_import' AND diff->>'origin'=$1",[origin]))[0];
      if(previous){const details=z.object({digest:z.string()}).passthrough().parse(previous.diff);if(details.digest!==digest)throw new Error('Origem já importada com conteúdo diferente.');return {alreadyImported:true};}
      const columns=await tx.query('SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema()');
      async function insert(table:string,row:Row,generated=true,conflict=false){
        const copy={...row};if(generated)delete copy.id;
        const names=Object.keys(copy);const values=names.map(name=>['json','jsonb'].includes(String(columns.find(c=>c.table_name===table && c.column_name===name)?.data_type)) && copy[name]!==null?JSON.stringify(copy[name]):copy[name]);
        const result=await tx.query(`INSERT INTO ${sqlIdentifier(table)} (${names.map(sqlIdentifier).join(',')}) VALUES (${names.map((_,i)=>`$${i+1}`).join(',')})${conflict?' ON CONFLICT DO NOTHING':''}${generated?' RETURNING id':''}`,values);
        if(generated)remember(table,row.id,result[0].id);
      }
      const categories=await tx.query('SELECT id,slug FROM categories');
      const services=await tx.query('SELECT id,category_id,slug FROM services');
      const questions=await tx.query('SELECT id,service_id,label,position FROM service_questions');
      for(const category of source.categories){const found=categories.find(row=>row.slug===category.slug);if(!found)throw new Error('Categoria sem correspondência.');remember('categories',category.id,found.id);}
      for(const service of source.services){const found=services.find(row=>Number(row.category_id)===mapped('categories',service.category_id) && row.slug===service.slug);if(!found)throw new Error('Serviço sem correspondência.');remember('services',service.id,found.id);}
      for(const question of source.service_questions){const found=questions.find(row=>Number(row.service_id)===mapped('services',question.service_id) && row.label===question.label && Number(row.position)===Number(question.position));if(!found)throw new Error('Pergunta sem correspondência.');remember('service_questions',question.id,found.id);}
      for(const user of source.users){const found=(await tx.query('SELECT id,phone,role FROM users WHERE email=$1',[user.email]))[0];if(found){if(found.phone!==user.phone || found.role!==user.role)throw new Error('Identidade existente incompatível com a origem.');remember('users',user.id,found.id);}else await insert('users',user);}
      for(const pro of source.professionals){const userId=mapped('users',pro.user_id);const found=(await tx.query('SELECT user_id FROM professionals WHERE user_id=$1',[userId]))[0];if(!found)await insert('professionals',{...pro,user_id:userId},false);}
      await tx.query('INSERT INTO professional_services(pro_id,service_id) SELECT pro_id,service_id FROM jsonb_to_recordset($1::jsonb) AS rows(pro_id bigint,service_id integer) ON CONFLICT DO NOTHING',[JSON.stringify(source.professional_services.map(row=>({...row,pro_id:mapped('users',row.pro_id),service_id:mapped('services',row.service_id)})))]);
      await tx.query('INSERT INTO professional_coverage(pro_id,city_id) SELECT pro_id,city_id FROM jsonb_to_recordset($1::jsonb) AS rows(pro_id bigint,city_id integer) ON CONFLICT DO NOTHING',[JSON.stringify(source.professional_coverage.map(row=>({...row,pro_id:mapped('users',row.pro_id)})))]);
      for(const row of source.requests)await insert('requests',{...row,client_id:mapped('users',row.client_id),service_id:mapped('services',row.service_id)});
      for(const row of source.request_answers)await insert('request_answers',{...row,request_id:mapped('requests',row.request_id),question_id:mapped('service_questions',row.question_id)});
      for(const row of source.leads)await insert('leads',{...row,request_id:mapped('requests',row.request_id),pro_id:mapped('users',row.pro_id)});
      let ledgerInserted=0,creditsReused=0;
      for(const row of source.coin_transactions){
        const proId=mapped('users',row.pro_id),transactionKey=row.type==='bonus' && String(row.idempotency_key).startsWith('demo-bonus:')?`demo-bonus:${proId}`:key(row.idempotency_key);
        const previous=(await tx.query('SELECT * FROM coin_transactions WHERE idempotency_key=$1',[transactionKey]))[0];
        if(previous){if(row.type!=='bonus' || previous.type!==row.type || Number(previous.pro_id)!==proId || Number(previous.amount)!==Number(row.amount) || previous.lead_id!==null || previous.payment_id!==null)throw new Error('Lançamento existente incompatível.');remember('coin_transactions',row.id,previous.id);creditsReused++;continue;}
        await insert('coin_transactions',{...row,pro_id:proId,lead_id:mapped('leads',row.lead_id),idempotency_key:transactionKey});ledgerInserted++;
      }
      for(const row of source.idempotent_results){if(row.operation!=='unlock')throw new Error('Operação idempotente não mapeada.');await insert('idempotent_results',{...row,key:key(row.key),actor_id:mapped('users',row.actor_id),resource_id:mapped('leads',row.resource_id)},false);}
      for(const row of source.notifications)await insert('notifications',{...row,user_id:mapped('users',row.user_id),payload:payload(row.payload)});
      for(const row of source.refresh_sessions)await insert('refresh_sessions',{...row,user_id:mapped('users',row.user_id)},false);
      await verify(tx);
      const summary={origin,digest,requests:source.requests.length,leads:source.leads.length,answers:source.request_answers.length,notifications:source.notifications.length,sessions:source.refresh_sessions.length,ledgerInserted,creditsReused};
      await tx.query("INSERT INTO audit_logs(action,entity,diff) VALUES ('database.local_import','database',$1)",[JSON.stringify({...summary,idMaps:Object.fromEntries([...maps].map(([table,values])=>[table,Object.fromEntries(values)]))})]);
      return summary;
    });
    console.log(JSON.stringify(result,null,2));
  }finally{await db.close();}
}
async function verify(tx:Executor){
  const [result]=await tx.query("SELECT (SELECT count(*) FROM wallets w WHERE balance<>(SELECT COALESCE(sum(amount),0) FROM coin_transactions c WHERE c.pro_id=w.pro_id)) wallets,(SELECT count(*) FROM requests r WHERE unlocked_count<>(SELECT count(*) FROM coin_transactions c JOIN leads l ON l.id=c.lead_id WHERE l.request_id=r.id AND c.type='unlock')) slots");
  if(Number(result.wallets)!==0 || Number(result.slots)!==0)throw new Error('Importação divergente; transação revertida.');
}
run().catch(error=>{console.error(startupMessage(error));process.exitCode=1;});
