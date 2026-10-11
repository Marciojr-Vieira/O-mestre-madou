import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';
import { bootstrap } from '../apps/api/src/main';
import { validDocument } from '../packages/shared/src';
let app:INestApplication,db:Database,base:string,admin:string,client:{token:string;user:{id:number}},pro:{token:string;user:{id:number}};
before(async()=>{
  config.PORT=0;config.DATA_DIR='memory://';config.DATABASE_MODE=process.env.ELO_TEST_SCHEMA?'postgres':'embedded';
  config.DATABASE_SCHEMA=process.env.ELO_TEST_SCHEMA?`${process.env.ELO_TEST_SCHEMA}_registration`:'public';config.DATABASE_MIGRATE='true';config.DEMO_MODE='true';
  const result=await bootstrap();app=result.app;db=result.db;base=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/v1`;
  admin=(await (await call('/auth/demo','POST',{role:'admin'})).json() as {token:string}).token;
});
after(async()=>{await app.close();await db.close();});
function call(path:string,method='GET',body?:unknown,token?:string){return fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const clientInput={name:'Cliente cadastro completo',email:'complete-client@test.invalid',phone:'+5563999770010',password:'CadastroSeguro123!',role:'client',cityId:1721000,neighborhood:'Plano Diretor Norte',consent:true};
const professionalInput={...clientInput,role:'pro',name:'Profissional cadastro completo',email:'complete-pro@test.invalid',phone:'+5563999770011',professional:{document:'529.982.247-25',bio:'Trabalho com manutenção elétrica e reparos residenciais há cinco anos.',services:[1],cities:[1721000]}};
test('documents accept valid CPF, numeric and alphanumeric CNPJ while rejecting altered digits',()=>{
  for(const document of ['52998224725','11222333000181','12ABC34501DE35','00000000E08G12'])assert.equal(validDocument(document),true,document);
  for(const document of ['52998224724','11111111111','00000000000000','12ABC34501DE34','?52998224725'])assert.equal(validDocument(document),false,document);
});
test('client registration persists location and consent; private account editing preserves role and contact',async()=>{
  const response=await call('/auth/register','POST',clientInput);assert.equal(response.status,201);client=await response.json() as typeof client;
  const account=await (await call('/auth/profile','GET',undefined,client.token)).json() as Record<string,unknown>;
  assert.equal(account.cityId,1721000);assert.equal(account.neighborhood,clientInput.neighborhood);assert.equal(account.phoneVerified,false);assert.equal(account.password_hash,undefined);
  assert.equal((await call('/auth/profile','PATCH',{name:'Cliente nome atualizado',cityId:1721000,neighborhood:'Centro',role:'admin',phone:'+5563999770099'},client.token)).status,200);
  const [row]=await db.query('SELECT name,role,phone,consent_at FROM users WHERE id=$1',[client.user.id]);assert.equal(row.role,'client');assert.equal(row.phone,clientInput.phone);assert.ok(row.consent_at);
  assert.equal((await call('/auth/profile')).status,401);
});
test('professional registration validates database catalog and rolls back all records on failure',async()=>{
  assert.equal((await call('/auth/register','POST',{...professionalInput,professional:undefined})).status,400);
  assert.equal((await call('/auth/register','POST',{...professionalInput,professional:{...professionalInput.professional,services:[999999]}})).status,400);
  assert.equal((await db.query('SELECT id FROM users WHERE email=$1',[professionalInput.email])).length,0);
  assert.equal((await call('/auth/register','POST',{...professionalInput,professional:{...professionalInput.professional,cities:[999999]}})).status,400);
  assert.equal((await db.query('SELECT id FROM users WHERE email=$1',[professionalInput.email])).length,0);
  const response=await call('/auth/register','POST',professionalInput);assert.equal(response.status,201);pro=await response.json() as typeof pro;
  const own=await (await call('/pro/profile','GET',undefined,pro.token)).json() as Record<string,unknown>;
  assert.equal(own.document,'52998224725');assert.equal(own.verification_status,'pending');assert.deepEqual(own.services,[1]);assert.deepEqual(own.cities,[1721000]);
  const [wallet]=await db.query('SELECT balance FROM wallets WHERE pro_id=$1',[pro.user.id]);assert.equal(Number(wallet.balance),0);
  assert.equal((await db.query('SELECT id FROM coin_transactions WHERE pro_id=$1',[pro.user.id])).length,0);
  const opportunities=await (await call('/pro/leads','GET',undefined,pro.token)).json() as {id:number}[];
  assert.ok(opportunities.length>0,'New profile must see existing matching requests without resaving.');
  const publicProfile=await (await call(`/professionals/${pro.user.id}`)).json() as Record<string,unknown>;
  assert.equal(publicProfile.document,undefined);assert.equal(publicProfile.document_number,undefined);assert.equal(publicProfile.email,undefined);
});
test('duplicate concurrent registrations create exactly one complete account',async()=>{
  const input={...clientInput,email:'concurrent-register@test.invalid',phone:'+5563999770012'};
  const responses=await Promise.all([call('/auth/register','POST',input),call('/auth/register','POST',input)]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[201,409]);assert.equal((await db.query('SELECT id FROM users WHERE email=$1',[input.email])).length,1);
});
test('only admin can toggle quick login, which remains blocked in production',async()=>{
  assert.equal((await call('/admin/demo-settings')).status,401);
  assert.equal((await call('/admin/demo-settings','PATCH',{enabled:false},client.token)).status,403);
  assert.equal((await call('/admin/demo-settings','PATCH',{enabled:false},admin)).status,200);
  assert.equal((await (await call('/auth/options')).json() as {demoLogin:boolean}).demoLogin,false);
  assert.equal((await call('/auth/demo','POST',{role:'client'})).status,404);
  assert.equal((await call('/auth/login','POST',{email:clientInput.email,password:clientInput.password})).status,201);
  assert.equal((await call('/admin/demo-settings','PATCH',{enabled:true},admin)).status,200);
  assert.equal((await (await call('/auth/options')).json() as {demoLogin:boolean}).demoLogin,true);
  config.DEMO_MODE='false';
  try{
    assert.equal((await call('/admin/demo-settings','PATCH',{enabled:true},admin)).status,409);
    assert.equal((await call('/auth/demo','POST',{role:'admin'})).status,404);
    const options=await (await call('/auth/options')).json() as {demoLogin:boolean;phoneVerification:string};assert.equal(options.demoLogin,false);assert.equal(options.phoneVerification,'manual');
    assert.equal((await call('/auth/login','POST',{email:'admin@demo.elo.invalid',password:'qualquer-senha'})).status,401);
  }finally{config.DEMO_MODE='true';}
  const previous={DATABASE_MODE:config.DATABASE_MODE,DATABASE_SCHEMA:config.DATABASE_SCHEMA,NODE_ENV:config.NODE_ENV};
  Object.assign(config,{DATABASE_MODE:'postgres',DATABASE_SCHEMA:'elo',NODE_ENV:'development'});
  try{
    assert.equal((await (await call('/auth/options')).json() as {demoLogin:boolean}).demoLogin,false);
    assert.equal((await call('/admin/demo-settings','PATCH',{enabled:true},admin)).status,409);
  }finally{Object.assign(config,previous);}
  assert.equal((await db.query("SELECT id FROM audit_logs WHERE action='demo.login.toggle'")).length,2);
});
test('manual phone approval requires admin, explicit confirmation and audit; enables real client requests',async()=>{
  const path=`/admin/accounts/${client.user.id}/confirm-phone`,body={reason:'Contato confirmado diretamente pela administração em atendimento.',confirmed:true};
  assert.equal((await call(path,'POST',body,pro.token)).status,403);
  assert.equal((await call(path,'POST',{reason:body.reason},admin)).status,400);
  config.DEMO_MODE='false';
  try{
    assert.equal((await call('/auth/otp','POST',{},client.token)).status,503);
    assert.equal((await call(path,'POST',body,admin)).status,201);
  }finally{config.DEMO_MODE='true';}
  const user=await (await call('/auth/me','GET',undefined,client.token)).json() as {phoneVerified:boolean};assert.equal(user.phoneVerified,true);
  await call(path,'POST',body,admin);
  assert.equal((await db.query("SELECT id FROM audit_logs WHERE action='account.phone.manual-confirm' AND entity_id=$1",[client.user.id])).length,1);
  const questions=await db.query('SELECT id,options FROM service_questions WHERE service_id=1');
  const response=await call('/requests','POST',{serviceId:1,cityId:1721000,description:'Precisamos de manutenção e limpeza na residência durante a semana.',urgency:'flexible',answers:Object.fromEntries(questions.map(question=>[String(question.id),(question.options as string[])[0]])),consent:true},client.token);
  assert.equal(response.status,201);
});
