import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';
import { bootstrap } from '../apps/api/src/main';
let app:INestApplication,db:Database,base:string;
before(async()=>{config.PORT=0;config.DATA_DIR='memory://';config.DATABASE_MODE=process.env.ELO_TEST_SCHEMA?'postgres':'embedded';config.DATABASE_SCHEMA=process.env.ELO_TEST_SCHEMA?`${process.env.ELO_TEST_SCHEMA}_http`:'public';config.DATABASE_MIGRATE='true';config.DEMO_MODE='true';const result=await bootstrap();app=result.app;db=result.db;base=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/v1`;});
after(async()=>{await app.close();await db.close();});
async function demo(role:string){const response=await fetch(`${base}/auth/demo`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});return response.json() as Promise<{token:string;user:{id:number}}>}
test('fixed prices require professional ownership, opt-in and approved coverage without exposing contacts',async()=>{
  const pro=await demo('pro'),client=await demo('client');
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${pro.token}`};
  const serviceId=Number((await db.query("SELECT id FROM services WHERE slug='diarista'"))[0].id);
  const input={serviceId,cityId:1721000,title:'Limpeza residencial completa',description:'Limpeza de apartamento até sessenta metros quadrados, sem materiais inclusos.',priceCents:15099,unit:'service',active:true};
  assert.equal((await fetch(`${base}/pro/fixed-prices`,{method:'POST',headers:{...headers,Authorization:`Bearer ${client.token}`},body:JSON.stringify(input)})).status,403);
  for(const priceCents of [0,-1,1.5,100000001])assert.equal((await fetch(`${base}/pro/fixed-prices`,{method:'POST',headers,body:JSON.stringify({...input,priceCents})})).status,400);
  assert.equal((await fetch(`${base}/pro/fixed-prices`,{method:'POST',headers,body:JSON.stringify({...input,description:'Meu contato é pessoa@example.com para combinar.'})})).status,400);
  const created=await fetch(`${base}/pro/fixed-prices`,{method:'POST',headers,body:JSON.stringify(input)});assert.equal(created.status,201);
  const {id}=await created.json() as {id:number};
  async function publicOffers(){return await (await fetch(`${base}/fixed-prices`)).json() as Record<string,unknown>[];}
  assert.equal((await publicOffers()).length,0);
  assert.equal((await fetch(`${base}/pro/fixed-prices/settings`,{method:'PATCH',headers,body:JSON.stringify({enabled:true})})).status,200);
  const published=(await publicOffers())[0];assert.equal(published.priceCents,15099);assert.equal(published.title,input.title);
  assert.equal(published.phone,undefined);assert.equal(published.email,undefined);assert.equal(published.document_number,undefined);
  await db.query("UPDATE professionals SET verification_status='pending' WHERE user_id=$1",[pro.user.id]);assert.equal((await publicOffers()).length,0);
  await db.query("UPDATE professionals SET verification_status='verified' WHERE user_id=$1",[pro.user.id]);
  await db.query('DELETE FROM professional_services WHERE pro_id=$1 AND service_id=$2',[pro.user.id,serviceId]);assert.equal((await publicOffers()).length,0);
  assert.equal((await fetch(`${base}/pro/fixed-prices/${id}`,{method:'PATCH',headers,body:JSON.stringify(input)})).status,400);
  await db.query('INSERT INTO professional_services VALUES ($1,$2)',[pro.user.id,serviceId]);
  const otherId=Number((await db.query("SELECT id FROM users WHERE email='pro2@demo.elo.invalid'"))[0].id);
  await db.query('UPDATE fixed_price_offers SET pro_id=$1 WHERE id=$2',[otherId,id]);
  assert.equal((await fetch(`${base}/pro/fixed-prices/${id}`,{method:'PATCH',headers,body:JSON.stringify(input)})).status,404);
  assert.equal((await fetch(`${base}/pro/fixed-prices/${id}`,{method:'DELETE',headers})).status,404);
  await db.query('UPDATE fixed_price_offers SET pro_id=$1 WHERE id=$2',[pro.user.id,id]);
  assert.equal((await fetch(`${base}/pro/fixed-prices/${id}`,{method:'PATCH',headers,body:JSON.stringify({...input,priceCents:19950,active:false})})).status,200);
  assert.equal((await publicOffers()).length,0);
  assert.equal((await fetch(`${base}/pro/fixed-prices/${id}`,{method:'DELETE',headers})).status,200);
  await fetch(`${base}/pro/fixed-prices/settings`,{method:'PATCH',headers,body:JSON.stringify({enabled:false})});
});
test('private endpoints deny anonymous and incorrect roles',async()=>{assert.equal((await fetch(`${base}/pro/leads`)).status,401);const client=await demo('client');assert.equal((await fetch(`${base}/admin/overview`,{headers:{Authorization:`Bearer ${client.token}`}})).status,403);assert.equal((await fetch(`${base}/pro/leads`,{headers:{Authorization:`Bearer ${client.token}`}})).status,403);});
test('catalog publishes Palmas only and complete form definitions',async()=>{const response=await fetch(`${base}/catalog`);const catalog=await response.json() as {cities:{name:string}[];services:{questions:unknown[]}[]};assert.deepEqual(catalog.cities.map(c=>c.name),['Palmas']);assert.ok(catalog.services.every(s=>s.questions.length>0));});
test('validation rejects missing idempotency key and unsafe contact in descriptions',async()=>{const pro=await demo('pro');const leads=await (await fetch(`${base}/pro/leads`,{headers:{Authorization:`Bearer ${pro.token}`}})).json() as {id:number}[];const response=await fetch(`${base}/leads/${leads[0].id}/unlock`,{method:'POST',headers:{Authorization:`Bearer ${pro.token}`}});assert.equal(response.status,400);const data=await response.json() as {error:{code:string}};assert.equal(data.error.code,'VALIDATION_ERROR');const client=await demo('client');assert.equal((await fetch(`${base}/requests`,{method:'POST',headers:{Authorization:`Bearer ${client.token}`,'Content-Type':'application/json'},body:JSON.stringify({serviceId:1,cityId:1721000,description:'Contato pelo email pessoa@example.com por favor',urgency:'flexible',answers:{},consent:true})})).status,400);});
test('refresh endpoint rejects foreign origins',async()=>{const response=await fetch(`${base}/auth/refresh`,{method:'POST',headers:{Origin:'https://foreign.invalid'}});assert.equal(response.status,403);});
test('refresh rotates cookies and account deletion revokes authentication',async()=>{
  const registration=await fetch(`${base}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'client',name:'Cliente de teste de sessão',email:'session-test@elo.invalid',phone:'+5563000099999',password:'TesteSeguro123!',consent:true})});
  assert.equal(registration.status,201);
  const cookie=registration.headers.get('set-cookie')!.split(';')[0];
  const refreshed=await fetch(`${base}/auth/refresh`,{method:'POST',headers:{Origin:config.WEB_ORIGIN,Cookie:cookie}});
  assert.equal(refreshed.status,201);
  const session=await refreshed.json() as {token:string};
  assert.notEqual(refreshed.headers.get('set-cookie')!.split(';')[0],cookie);
  assert.equal((await fetch(`${base}/auth/refresh`,{method:'POST',headers:{Origin:config.WEB_ORIGIN,Cookie:cookie}})).status,401);
  assert.equal((await fetch(`${base}/auth/account`,{method:'DELETE',headers:{Authorization:`Bearer ${session.token}`}})).status,200);
  assert.equal((await fetch(`${base}/requests`,{headers:{Authorization:`Bearer ${session.token}`}})).status,401);
});
test('complete lifecycle: register, OTP, request, contact, review, moderation, reply and refund',async()=>{
  async function call<T>(path:string,token:string,method='GET',body?:unknown,key?:string){const res=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await res.json();assert.ok(res.ok,`${path}: ${JSON.stringify(result)}`);return result as T;}
  const register=await fetch(`${base}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Cliente novo teste',email:'novo@teste.invalid',phone:'+5563999991234',password:'password-test-123',role:'client',consent:true})});assert.equal(register.status,201);const client=await register.json() as {token:string;user:{id:number}};
  const otp=await call<{demoCode:string}>('/auth/otp',client.token,'POST',{});assert.match(otp.demoCode,/^\d{6}$/);await call('/auth/otp/verify',client.token,'POST',{code:otp.demoCode});
  const catalog=await (await fetch(`${base}/catalog`)).json() as {services:{id:number;slug:string;questions:{id:number;options:string[]}[]}[]};const service=catalog.services.find(s=>s.slug==='diarista')!;
  const request=await call<{id:number}>('/requests',client.token,'POST',{serviceId:service.id,cityId:1721000,description:'Preciso de limpeza completa em um apartamento com dois quartos.',urgency:'this_week',answers:Object.fromEntries(service.questions.map(q=>[String(q.id),q.options[0]])),consent:true});
  const pro=await demo('pro');const leads=await call<{id:number;request_id:number;contact?:unknown}[]>('/pro/leads',pro.token);const lead=leads.find(l=>Number(l.request_id)===request.id)!;assert.ok(lead);assert.equal(lead.contact,undefined);
  const contact=await call<{name:string;phone:string}>(`/leads/${lead.id}/unlock`,pro.token,'POST',{},'complete-flow-unlock');assert.equal(contact.name,'Cliente novo teste');
  const requests=await call<{id:number;professionals:{id:number}[]}[]>('/requests',client.token);assert.equal(requests.find(r=>Number(r.id)===request.id)?.professionals.length,1);
  await call('/reviews',client.token,'POST',{leadId:lead.id,rating:5,comment:'Profissional atencioso e serviço bem executado.'});const reviewId=Number((await db.query('SELECT id FROM reviews WHERE lead_id=$1',[lead.id]))[0].id);
  const admin=await demo('admin');await call(`/admin/reviews/${reviewId}/moderate`,admin.token,'POST',{published:true});await call(`/reviews/${reviewId}/reply`,pro.token,'POST',{reply:'Obrigado por compartilhar sua experiência.'});
  const profile=await call<{rating_count:number;reviews:{pro_reply:string}[]}>(`/professionals/${pro.user.id}`,client.token);assert.equal(Number(profile.rating_count),1);assert.ok(profile.reviews[0].pro_reply);
  await call(`/leads/${lead.id}/refund`,pro.token,'POST',{reason:'Contato inválido informado na solicitação de teste.'});const refundId=Number((await db.query('SELECT id FROM refund_requests WHERE lead_id=$1',[lead.id]))[0].id);await call(`/admin/refunds/${refundId}/resolve`,admin.token,'POST',{approved:true});
  const after=await call<{id:number;contact?:unknown}[]>('/pro/leads',pro.token);assert.equal(after.find(l=>Number(l.id)===Number(lead.id))?.contact,undefined);
});
test('purchase uses server package values, preserves idempotency, and confirms only once',async()=>{
  const pro=await demo('pro');const headers={'Content-Type':'application/json',Authorization:`Bearer ${pro.token}`,'Idempotency-Key':'purchase-http-repeat'};
  const body=JSON.stringify({packageId:1,method:'pix',coins:99999,amount_cents:1});const created=await fetch(`${base}/pro/wallet/purchase`,{method:'POST',headers,body});assert.equal(created.status,201);const first=await created.json() as {id:number;coins:number;amount_cents:number};assert.equal(first.coins,20);assert.equal(first.amount_cents,2000);
  const repeated=await (await fetch(`${base}/pro/wallet/purchase`,{method:'POST',headers,body})).json() as {id:number};assert.equal(Number(repeated.id),Number(first.id));
  for(let i=0;i<2;i++)assert.equal((await fetch(`${base}/payments/${first.id}/demo-confirm`,{method:'POST',headers})).status,201);
  assert.equal(Number((await db.query("SELECT count(*) count FROM coin_transactions WHERE payment_id=$1 AND type='purchase'",[first.id]))[0].count),1);
});
