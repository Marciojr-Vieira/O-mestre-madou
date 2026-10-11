import { Worker } from 'bullmq';
import { Logger } from '@nestjs/common';
import { config } from './config';
import { Database } from './database';
import { Marketplace } from './domain';
async function start() {
  if(!config.REDIS_URL || config.DATABASE_MODE!=='postgres')throw new Error('Worker requires PostgreSQL and REDIS_URL');
  const url=new URL(config.REDIS_URL);const db=new Database();await db.initialize();const market=new Marketplace(db);
  const worker=new Worker('marketplace',async job=>{
    if(job.name==='match-request')await market.match(Number(job.data.requestId));
    if(job.name==='expire-requests')await market.expire();
  },{connection:{host:url.hostname,port:Number(url.port||6379),password:url.password||undefined,username:url.username||undefined,tls:url.protocol==='rediss:'?{}:undefined}});
  worker.on('failed',()=>Logger.error('Job failed','Worker'));
  process.on('SIGTERM',()=>{worker.close().then(()=>db.close()).catch(()=>Logger.error('Shutdown failed','Worker'));});
}
start().catch(()=>{Logger.error('Worker unavailable. Check Redis and PostgreSQL.','Worker');process.exitCode=1;});
