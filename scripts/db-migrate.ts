import { Database } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';
import { startupMessage } from '../apps/api/src/startup';
async function run() {
  if(config.DATABASE_MODE!=='postgres')throw new Error('db-migrate exige DATABASE_MODE=postgres.');
  const db=new Database('postgres',config.DATA_DIR,{migrate:true});
  try { await db.initialize();console.log(`Migrations e catálogo aplicados no schema ${config.DATABASE_SCHEMA}.`); }
  finally { await db.close(); }
}
run().catch(error=>{console.error(startupMessage(error));process.exitCode=1;});
