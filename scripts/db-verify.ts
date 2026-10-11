import { Database } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';
import { startupMessage } from '../apps/api/src/startup';
async function run() {
  if(config.DATABASE_MODE!=='postgres')throw new Error('db-verify exige DATABASE_MODE=postgres.');
  const db=new Database('postgres',config.DATA_DIR,{migrate:false});
  try {
    await db.initialize();
    const [result]=await db.query(`SELECT
      (SELECT count(*) FROM categories WHERE is_active) categories,
      (SELECT count(*) FROM services WHERE is_active) services,
      (SELECT count(*) FROM cities WHERE id=1721000) launch_city,
      (SELECT count(*) FROM services s WHERE s.is_active AND NOT EXISTS(SELECT 1 FROM service_questions q WHERE q.service_id=s.id)) missing_forms,
      (SELECT count(*) FROM services s WHERE s.is_active AND NOT EXISTS(SELECT 1 FROM lead_pricing_rules p WHERE p.service_id=s.id AND p.coin_cost>0 AND p.valid_from<=now() AND (p.valid_to IS NULL OR p.valid_to>now()))) missing_prices,
      (SELECT count(*) FROM wallets w WHERE w.balance<>(SELECT COALESCE(sum(amount),0) FROM coin_transactions t WHERE t.pro_id=w.pro_id)) wallet_mismatches,
      (SELECT count(*) FROM requests r WHERE r.unlocked_count<>(SELECT count(*) FROM coin_transactions t JOIN leads l ON l.id=t.lead_id WHERE l.request_id=r.id AND t.type='unlock')) slot_mismatches,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind='r' AND NOT c.relrowsecurity) unprotected_tables`);
    console.log(JSON.stringify(result,null,2));
    for(const key of ['missing_forms','missing_prices','wallet_mismatches','slot_mismatches','unprotected_tables'])if(Number(result[key])!==0)throw Object.assign(new Error('Database verification failed'),{code:'DATABASE_INCONSISTENT'});
    if(Number(result.categories)!==10 || Number(result.services)<111 || Number(result.launch_city)!==1)throw Object.assign(new Error('Launch catalog incomplete'),{code:'CATALOG_INCOMPLETE'});
    console.log('Catálogo, RLS, saldos e desbloqueios verificados.');
  }finally{await db.close();}
}
run().catch(error=>{console.error(startupMessage(error));process.exitCode=1;});
