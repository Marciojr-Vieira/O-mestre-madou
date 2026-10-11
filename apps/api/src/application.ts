import 'reflect-metadata';
import { Module, Catch, HttpException, Logger, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Database } from './database';
import { Marketplace } from './domain';
import { Auth } from './auth';
import { config } from './config';
import { ApiController } from './controller';
import { seedDemo } from './demo';
import { demoAvailable } from './demo-settings';

@Catch()
class ApiFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) { res.status(error.getStatus()).json(error.getResponse()); return; }
    if (error instanceof ZodError) { res.status(400).json({error:{code:'VALIDATION_ERROR',message:error.issues[0]?.message ?? 'Dados inválidos.'}}); return; }
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if(code==='23505'){res.status(409).json({error:{code:'DUPLICATE',message:'Este registro já existe.'}});return;}
    if(code==='23503'){res.status(400).json({error:{code:'INVALID_REFERENCE',message:'Registro relacionado inválido.'}});return;}
    Logger.error(`Request failed (${code || 'internal'})`, 'API');
    res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Não foi possível concluir a operação.'}});
  }
}

/** Local server and Netlify share authorization and financial transactions. */
export async function createApplication() {
  const db=new Database();
  try {
    if(config.DEMO_MODE==='true'&&!demoAvailable())throw new Error('Use um schema separado com sufixo _demo para executar demonstrações.');
    await db.initialize();if(config.DEMO_MODE==='true')await seedDemo(db);
  }
  catch(error) { await db.close().catch(()=>{}); throw error; }
  @Module({controllers:[ApiController],providers:[{provide:'DATABASE',useValue:db},{provide:'AUTH',useValue:new Auth(db)},{provide:'MARKET',useValue:new Marketplace(db)}]}) class AppModule {}
  try {
    const app=await NestFactory.create(AppModule, {logger:['error','warn']});
    app.use(cookieParser());app.useGlobalFilters(new ApiFilter());
    app.enableCors({origin:config.WEB_ORIGIN,credentials:true,allowedHeaders:['Content-Type','Authorization','Idempotency-Key']});
    const attempts=new Map<string,{count:number;until:number}>();
    app.use((req:Request,res:Response,next:NextFunction)=>{
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
      if(req.path.startsWith('/v1')) res.setHeader('Cache-Control','no-store');
      if(req.method==='POST' && (/\/auth\//.test(req.path) || req.path==='/v1/requests')){
        const key=`${req.ip}:${req.path}`,now=Date.now(); const current=attempts.get(key);
        const window=current && current.until>now?current:{count:0,until:now+60000};window.count++;attempts.set(key,window);
        if(window.count>20){res.status(429).json({error:{code:'RATE_LIMIT',message:'Aguarde um minuto antes de tentar novamente.'}});return;}
        if(attempts.size>10000) for(const [k,v] of attempts) if(v.until<=now)attempts.delete(k);
      }next();
    });
    await app.init();
    return {app,db};
  } catch(error) { await db.close();throw error; }
}
