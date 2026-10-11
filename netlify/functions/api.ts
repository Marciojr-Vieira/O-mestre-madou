import 'reflect-metadata';
import serverless from 'serverless-http';
import type { Handler, HandlerResponse } from '@netlify/functions';
import { createApplication } from '../../apps/api/src/application';
import { config } from '../../apps/api/src/config';
import { assertNetlifyConfiguration } from '../../apps/api/src/deployment-policy';

let initialized: Promise<ReturnType<typeof serverless>> | undefined;
function getHandler() {
  if(!initialized) initialized=(async()=>{
    assertNetlifyConfiguration(config);
    const {app}=await createApplication();
    return serverless(app.getHttpAdapter().getInstance(),{request:(request: {url:string})=>{
      request.url=request.url.replace(/^\/\.netlify\/functions\/api(?=\/|\?|$)/,'');
    }});
  })().catch(error=>{initialized=undefined;throw error;});
  return initialized;
}
export const handler: Handler=async(event,context)=>{
  context.callbackWaitsForEmptyEventLoop=false;
  try { return await (await getHandler())(event,context) as HandlerResponse; }
  catch {
    console.error('Falha ao inicializar a API. Confira as variáveis e a conexão PostgreSQL.');
    return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:{code:'API_UNAVAILABLE',message:'Serviço temporariamente indisponível. Tente novamente.'}})};
  }
};
