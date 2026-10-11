import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Database } from '../apps/api/src/database';
import { Marketplace } from '../apps/api/src/domain';
import { seedDemo } from '../apps/api/src/demo';
import type { User } from '../packages/shared/src';
const db=new Database(process.env.ELO_TEST_SCHEMA?'postgres':'embedded','memory://',process.env.ELO_TEST_SCHEMA?{schema:`${process.env.ELO_TEST_SCHEMA}_security`,migrate:true,runtimeRole:''}:{});
const runtime=process.env.ELO_TEST_SCHEMA?new Database('postgres','memory://',{schema:`${process.env.ELO_TEST_SCHEMA}_security`,migrate:false,runtimeRole:'elo_runtime'}):db;
before(async()=>{await db.initialize();await seedDemo(db);if(runtime!==db)await runtime.initialize();});
after(async()=>{if(runtime!==db)await runtime.close();await db.close();});
test('runtime role can unlock via the ledger but cannot change cached balances or mutate the ledger',async()=>{
  const [row]=await db.query("SELECT id,name FROM users WHERE email='profissional@demo.elo.invalid'");
  const pro:User={id:Number(row.id),name:String(row.name),role:'pro',phoneVerified:true};
  const [lead]=await db.query("SELECT id FROM leads WHERE pro_id=$1 AND status='offered' ORDER BY id LIMIT 1",[pro.id]);
  const balance=Number((await db.query('SELECT balance FROM wallets WHERE pro_id=$1',[pro.id]))[0].balance);
  if(runtime===db)await db.query('SET ROLE elo_runtime');
  try {
    assert.equal((await runtime.query('SELECT current_user name'))[0].name,'elo_runtime');
    await assert.rejects(runtime.query('UPDATE wallets SET balance=999 WHERE pro_id=$1',[pro.id]),{code:'42501'});
    await assert.rejects(runtime.query('INSERT INTO wallets(pro_id,balance) VALUES ($1,999)',[pro.id]),{code:'42501'});
    await assert.rejects(runtime.query('UPDATE coin_transactions SET amount=999 WHERE pro_id=$1',[pro.id]),{code:'42501'});
    await assert.rejects(runtime.query('DELETE FROM coin_transactions WHERE pro_id=$1',[pro.id]),{code:'42501'});
    assert.equal((await runtime.query('SELECT current_user name'))[0].name,'elo_runtime');
    await new Marketplace(runtime).unlock(pro,Number(lead.id),randomUUID());
    assert.equal(Number((await runtime.query('SELECT balance FROM wallets WHERE pro_id=$1',[pro.id]))[0].balance),balance-Number((await runtime.query('SELECT coin_cost FROM leads WHERE id=$1',[lead.id]))[0].coin_cost));
  }finally{if(runtime===db)await db.query('RESET ROLE');}
});
test('RLS denies all client access even if a table grant is accidentally added',async()=>{
  const role=`elo_browser_${randomUUID().replaceAll('-','')}`;
  const schema=String((await db.query('SELECT current_schema() name'))[0].name);
  await db.query(`CREATE ROLE ${role} NOLOGIN`);
  try {
    await db.query(`GRANT ${role} TO CURRENT_USER`);
    await db.query(`GRANT USAGE ON SCHEMA "${schema}" TO ${role}`);
    await db.query(`GRANT SELECT,INSERT ON users TO ${role}`);
    await db.transaction(async tx=>{
      await tx.query(`SET LOCAL ROLE ${role}`);
      assert.deepEqual(await tx.query('SELECT id FROM users'),[]);
    });
  }finally{await db.query(`DROP OWNED BY ${role}`);await db.query(`DROP ROLE ${role}`);}
  assert.equal(Number((await db.query("SELECT count(*) count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind='r' AND NOT c.relrowsecurity"))[0].count),0);
});
