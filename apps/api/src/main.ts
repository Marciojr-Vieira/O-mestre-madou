import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApplication } from './application';
import { Marketplace } from './domain';
import { config } from './config';
import { assertPortAvailable, startupMessage } from './startup';
export async function bootstrap() {
  await assertPortAvailable(config.PORT);
  const {app,db}=await createApplication();
  try { await app.listen(config.PORT,'127.0.0.1'); }
  catch(error) { await app.close();await db.close();throw error; }
  const expiry=setInterval(()=>{new Marketplace(db).expire().catch(()=>Logger.error('Expiration failed','Worker'));},60000);expiry.unref();
  const close=app.close.bind(app);
  app.close=async()=>{clearInterval(expiry);await close();await db.close();};
  Logger.log(`API ready at http://localhost:${config.PORT} — ${config.DEMO_MODE==='true'?'local demo':'production'}`,'O Mestre Mandou');
  app.enableShutdownHooks();return {app,db};
}
if (require.main === module) bootstrap().then(({app})=>{
  process.send?.({type:'ready'});
  process.on('message',message=>{
    if(typeof message==='object' && message!==null && 'type' in message && message.type==='shutdown') {
      void app.close().then(()=>{process.disconnect?.();}).catch(()=>{Logger.error('Falha ao encerrar o banco local.','O Mestre Mandou');process.exitCode=1;process.disconnect?.();});
    }
  });
}).catch(error=>{Logger.error(startupMessage(error),'O Mestre Mandou');process.exitCode=1;process.disconnect?.();});
