import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import serverless from 'serverless-http';
import { z } from 'zod';
import { createApplication } from '../apps/api/src/application';
import { config } from '../apps/api/src/config';

let application:Awaited<ReturnType<typeof createApplication>>;
let handler:ReturnType<typeof serverless>;
const responseSchema=z.object({statusCode:z.number(),body:z.string(),headers:z.record(z.string(),z.unknown()).optional(),multiValueHeaders:z.record(z.string(),z.array(z.string())).optional()});
before(async()=>{
  config.DATABASE_MODE='embedded';config.DATA_DIR='memory://';config.DATABASE_MIGRATE='true';config.DEMO_MODE='true';
  application=await createApplication();
  handler=serverless(application.app.getHttpAdapter().getInstance(),{request:(request:{url:string})=>{request.url=request.url.replace(/^\/\.netlify\/functions\/api(?=\/|\?|$)/,'');}});
});
after(async()=>{await application.app.close();await application.db.close();});
async function invoke(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){
  return responseSchema.parse(await handler({path,httpMethod:method,headers:{'content-type':'application/json',...headers},body:body===undefined?null:JSON.stringify(body),isBase64Encoded:false,requestContext:{identity:{sourceIp:'127.0.0.1'}}},{}));
}
test('serverless adapter serves original and rewritten API paths without listening on a port',async()=>{
  for(const path of ['/v1/health','/.netlify/functions/api/v1/health']){
    const response=await invoke(path);assert.equal(response.statusCode,200);assert.equal(JSON.parse(response.body).demo,true);
  }
  const catalog=await invoke('/.netlify/functions/api/v1/catalog');assert.equal(catalog.statusCode,200);assert.equal(JSON.parse(catalog.body).services.length,111);
});
test('serverless adapter preserves authorization and body validation',async()=>{
  assert.equal((await invoke('/v1/pro/leads')).statusCode,401);
  assert.equal((await invoke('/v1/auth/register','POST',{})).statusCode,400);
  const session=JSON.parse((await invoke('/v1/auth/demo','POST',{role:'client'})).body) as {token:string};
  assert.equal((await invoke('/v1/admin/overview','GET',undefined,{authorization:`Bearer ${session.token}`})).statusCode,403);
});
test('serverless adapter keeps refresh cookies and origin protection',async()=>{
  const session=await invoke('/v1/auth/demo','POST',{role:'client'});
  const single=session.headers?.['set-cookie'];
  const cookies=session.multiValueHeaders?.['set-cookie']??(typeof single==='string'?[single]:[]);assert.ok(cookies.length);
  const cookie=cookies[0].split(';')[0];
  assert.equal((await invoke('/v1/auth/refresh','POST',undefined,{origin:'https://foreign.invalid',cookie})).statusCode,403);
  const refreshed=await invoke('/v1/auth/refresh','POST',undefined,{origin:config.WEB_ORIGIN,cookie});assert.equal(refreshed.statusCode,201);
  const refreshedCookie=refreshed.multiValueHeaders?.['set-cookie']?.[0]??refreshed.headers?.['set-cookie'];
  assert.ok(refreshedCookie);assert.notEqual(refreshedCookie,cookies[0]);
});
