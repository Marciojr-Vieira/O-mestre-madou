import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Auth } from './auth';
import { Marketplace } from './domain';
import { FixedPrices } from './fixed-prices';
import { fixedPriceSchema } from '../../../packages/shared/src';
import { config } from './config';
import { fail, required } from './errors';
import { loginSchema, profileSchema, purchaseSchema, registerSchema, requestSchema, reviewSchema } from '../../../packages/shared/src';
import { accountSchema } from '../../../packages/shared/src';
import { registerAccount, saveProfessional, validateCity } from './registration';
import { demoSettings, demoAvailable } from './demo-settings';
const idSchema = z.coerce.number().int().positive();
const keySchema = z.string().min(8).max(150);
@Controller('v1')
export class ApiController {
  constructor(@Inject('AUTH') readonly auth: Auth, @Inject('MARKET') readonly market: Marketplace) {}
  get db() { return this.market.db; }
  @Get('fixed-prices') fixedPrices() { return new FixedPrices(this.db).publicList(); }
  @Get('pro/fixed-prices') async ownFixedPrices(@Req() req: Request) { return new FixedPrices(this.db).own((await this.auth.current(req,['pro'])).id); }
  @Patch('pro/fixed-prices/settings') async fixedPriceSettings(@Req() req: Request, @Body() body: unknown) {
    const user = await this.auth.current(req,['pro']); const { enabled } = z.object({ enabled: z.boolean() }).parse(body);
    return new FixedPrices(this.db).enable(user.id, enabled);
  }
  @Post('pro/fixed-prices') async createFixedPrice(@Req() req: Request, @Body() body: unknown) {
    return new FixedPrices(this.db).save((await this.auth.current(req,['pro'])).id, fixedPriceSchema.parse(body));
  }
  @Patch('pro/fixed-prices/:id') async updateFixedPrice(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return new FixedPrices(this.db).save((await this.auth.current(req,['pro'])).id, fixedPriceSchema.parse(body), idSchema.parse(id));
  }
  @Delete('pro/fixed-prices/:id') async deleteFixedPrice(@Req() req: Request, @Param('id') id: string) {
    return new FixedPrices(this.db).remove((await this.auth.current(req,['pro'])).id, idSchema.parse(id));
  }
  @Get('health') health() { return { status: 'ok', demo: config.DEMO_MODE === 'true', region: 'Palmas, TO' }; }
  @Get('auth/options') async authOptions() { return {demoLogin:(await demoSettings(this.db)).effective,phoneVerification:config.DEMO_MODE==='true'?'demo':'manual'}; }
  @Get('admin/demo-settings') async getDemoSettings(@Req() req:Request) { await this.auth.current(req,['admin']);return demoSettings(this.db); }
  @Patch('admin/demo-settings') async setDemoSettings(@Req() req:Request,@Body() body:unknown) {
    const actor=await this.auth.current(req,['admin']);const {enabled}=z.object({enabled:z.boolean()}).parse(body);
    if(enabled&&!demoAvailable())fail('DEMO_UNAVAILABLE','Ative acessos rápidos somente em um ambiente de demonstração separado.',409);
    await this.db.transaction(async tx=>{
      await tx.query('UPDATE application_settings SET demo_login_enabled=$1,updated_at=now(),updated_by=$2 WHERE singleton=true',[enabled,actor.id]);
      await this.market.audit(tx,actor.id,'demo.login.toggle','application_settings',1,{enabled});
    });
    return demoSettings(this.db);
  }
  @Get('catalog') async catalog() {
    const services = await this.db.query('SELECT s.id,s.name,s.slug,c.name category,c.slug "categorySlug" FROM services s JOIN categories c ON c.id=s.category_id WHERE s.is_active AND c.is_active ORDER BY c.position,s.name');
    const questions=await this.db.query('SELECT service_id,id,label,type,options,is_required FROM service_questions WHERE service_id=ANY($1::bigint[]) ORDER BY position',[services.map(service=>service.id)]);
    const questionsByService=new Map<number,typeof questions>();
    for(const row of questions){
      const {service_id,...question}=row;
      const id=Number(service_id),group=questionsByService.get(id)??[];
      group.push(question);questionsByService.set(id,group);
    }
    for(const service of services)service.questions=questionsByService.get(Number(service.id))??[];
    return { services, cities: await this.db.query('SELECT id,name,slug FROM cities WHERE state_id=17 ORDER BY name'), packages: await this.db.query('SELECT id,name,coins,price_cents FROM coin_packages WHERE is_active ORDER BY coins') };
  }
  @Post('auth/register') async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = registerSchema.parse(body);
    return this.auth.session(await registerAccount(this.db,input), res);
  }
  @Post('auth/login') async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = loginSchema.parse(body); const user = (await this.db.query("SELECT id,password_hash FROM users WHERE email=$1 AND status='active'", [input.email]))[0];
    if (!user || (config.DEMO_MODE!=='true'&&input.email.endsWith('@demo.elo.invalid')) || !(await verify(String(user.password_hash), input.password))) fail('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.', 401);
    return this.auth.session(Number(user.id), res);
  }
  @Post('auth/demo') async demo(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (!(await demoSettings(this.db)).effective) fail('NOT_FOUND', 'Acessos de demonstração indisponíveis.', 404);
    const { role } = z.object({ role: z.enum(['client','pro','admin']) }).parse(body);
    const [user] = await this.db.query('SELECT id FROM users WHERE email=$1', [`${{client:'cliente',pro:'profissional',admin:'admin'}[role]}@demo.elo.invalid`]);
    return this.auth.session(Number(required(user).id), res);
  }
  @Post('auth/refresh') refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.refresh(req, res); }
  @Post('auth/logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.auth.checkOrigin(req); const cookie = (req.cookies as Record<string, string>).elo_refresh;
    if (cookie && z.uuid().safeParse(cookie.split('.')[0]).success) await this.db.query('DELETE FROM refresh_sessions WHERE id=$1', [cookie.split('.')[0]]);
    res.clearCookie('elo_refresh', { path: '/v1/auth' }); return { ok: true };
  }
  @Get('auth/me') me(@Req() req: Request) { return this.auth.current(req); }
  @Get('auth/profile') async account(@Req() req:Request) {
    const user=await this.auth.current(req);
    const [row]=await this.db.query('SELECT email,phone,city_id "cityId",neighborhood FROM users WHERE id=$1',[user.id]);
    return {...user,...row};
  }
  @Get('admin/accounts') async pendingAccounts(@Req() req:Request) {
    await this.auth.current(req,['admin']);
    return this.db.query(`SELECT u.id,u.name,u.email,u.phone,u.role,u.created_at,c.name city
      FROM users u LEFT JOIN cities c ON c.id=u.city_id
      WHERE u.status='active' AND u.phone_verified_at IS NULL AND u.role IN ('client','pro') ORDER BY u.created_at DESC LIMIT 200`);
  }
  @Post('admin/accounts/:id/confirm-phone') async confirmPhone(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {
    const actor=await this.auth.current(req,['admin']),userId=idSchema.parse(id);
    const {reason}=z.object({reason:z.string().trim().min(15,'Descreva como o contato foi confirmado.').max(300),confirmed:z.literal(true)}).parse(body);
    await this.db.transaction(async tx=>{
      const user=required((await tx.query("SELECT id,phone_verified_at FROM users WHERE id=$1 AND status='active' AND role IN ('client','pro') FOR UPDATE",[userId]))[0]);
      if(user.phone_verified_at)return;
      await tx.query('UPDATE users SET phone_verified_at=now(),updated_at=now() WHERE id=$1',[userId]);
      await tx.query('DELETE FROM phone_challenges WHERE user_id=$1',[userId]);
      await this.market.audit(tx,actor.id,'account.phone.manual-confirm','user',userId,{method:'manual',reason});
    });
    return {verified:true};
  }
  @Patch('auth/profile') async updateAccount(@Req() req:Request,@Body() body:unknown) {
    const user=await this.auth.current(req);const input=accountSchema.parse(body);
    await this.db.transaction(async tx=>{
      await validateCity(tx,input.cityId);
      await tx.query('UPDATE users SET name=$1,city_id=$2,neighborhood=$3,updated_at=now() WHERE id=$4',[input.name,input.cityId,input.neighborhood,user.id]);
    });
    return this.account(req);
  }
  @Post('auth/otp') async otp(@Req() req: Request) { return this.auth.issueOtp((await this.auth.current(req)).id); }
  @Post('auth/otp/verify') async verifyPhone(@Req() req: Request,@Body() body: unknown) { const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(body); return this.auth.verifyOtp((await this.auth.current(req)).id, code); }
  @Get('pro/profile') async profile(@Req() req: Request) {
    const user = await this.auth.current(req,['pro']); const rows = await this.db.query('SELECT bio,document_number document,verification_status FROM professionals WHERE user_id=$1', [user.id]);
    return { ...rows[0], services: (await this.db.query('SELECT service_id FROM professional_services WHERE pro_id=$1',[user.id])).map(v=>Number(v.service_id)), cities: (await this.db.query('SELECT city_id FROM professional_coverage WHERE pro_id=$1',[user.id])).map(v=>Number(v.city_id)) };
  }
  @Post('pro/profile') async saveProfile(@Req() req: Request,@Body() body: unknown) {
    const user = await this.auth.current(req,['pro']); const input = profileSchema.parse(body);
    await this.db.transaction(async tx => {
      await saveProfessional(tx,user.id,input);
    });
    const requests = await this.db.query("SELECT id FROM requests WHERE status='open' AND expires_at>now()"); for (const request of requests) await this.market.match(Number(request.id));
    return { message: 'Perfil salvo. A aprovação documental é feita pela administração.' };
  }
  @Post('requests') async createRequest(@Req() req: Request,@Body() body: unknown) {
    const user = await this.auth.current(req,['client']); if (!user.phoneVerified) fail('PHONE_REQUIRED','Verifique seu telefone antes de publicar.',403);
    const input = requestSchema.parse(body);
    const [request] = await this.db.transaction(async tx => {
      if (!(await tx.query('SELECT id FROM services WHERE id=$1 AND is_active',[input.serviceId])).length || !(await tx.query('SELECT id FROM cities WHERE id=$1 AND state_id=17',[input.cityId])).length) fail('CATALOG_INVALID','Serviço ou cidade indisponível.');
      const questions = await tx.query('SELECT * FROM service_questions WHERE service_id=$1',[input.serviceId]);
      for (const question of questions) {
        const value = input.answers[String(question.id)];
        if (question.is_required && (value === undefined || value === '')) fail('ANSWER_REQUIRED', `Responda: ${question.label}`);
        if (value !== undefined && question.type === 'select' && !(question.options as unknown[]).includes(value)) fail('ANSWER_INVALID','Resposta inválida.');
      }
      if (Object.keys(input.answers).some(key => !questions.some(q=>String(q.id)===key))) fail('ANSWER_INVALID','Pergunta desconhecida.');
      const rows = await tx.query("INSERT INTO requests(client_id,service_id,city_id,description,urgency,expires_at) VALUES ($1,$2,$3,$4,$5,now()+interval '7 days') RETURNING id",[user.id,input.serviceId,input.cityId,input.description,input.urgency]);
      for (const [question,value] of Object.entries(input.answers)) await tx.query('INSERT INTO request_answers(request_id,question_id,value) VALUES ($1,$2,$3)',[rows[0].id,Number(question),JSON.stringify(value)]);
      return rows;
    });
    await this.market.match(Number(request.id)); return { id:Number(request.id), message:'Pedido publicado gratuitamente.' };
  }
  @Get('requests') async requests(@Req() req: Request) {
    const user = await this.auth.current(req,['client']); await this.market.expire();
    const rows = await this.db.query('SELECT r.id,r.status,r.description,r.unlocked_count,r.created_at,s.name service,c.name city FROM requests r JOIN services s ON s.id=r.service_id JOIN cities c ON c.id=r.city_id WHERE r.client_id=$1 ORDER BY r.created_at DESC LIMIT 50',[user.id]);
    for (const row of rows) row.professionals = await this.db.query(`SELECT l.id "leadId",u.id,u.name,u.phone,p.bio,p.rating_avg rating,EXISTS(SELECT 1 FROM reviews v WHERE v.lead_id=l.id) reviewed FROM leads l JOIN users u ON u.id=l.pro_id JOIN professionals p ON p.user_id=u.id WHERE l.request_id=$1 AND l.status IN ('unlocked','won','lost')`,[row.id]);
    return rows;
  }
  @Patch('requests/:id/cancel') async cancel(@Req() req: Request,@Param('id') id: string) { const user=await this.auth.current(req,['client']); const rows=await this.db.query("UPDATE requests SET status='cancelled' WHERE id=$1 AND client_id=$2 AND status='open' RETURNING id",[idSchema.parse(id),user.id]); required(rows[0]); return {ok:true}; }
  @Get('pro/leads') async leads(@Req() req: Request) {
    const user=await this.auth.current(req,['pro']);
    // Complete matching for newly registered profiles without requiring a profile resave.
    const requests=await this.db.query(`SELECT r.id FROM requests r
      JOIN professional_services ps ON ps.service_id=r.service_id AND ps.pro_id=$1
      JOIN professional_coverage pc ON pc.city_id=r.city_id AND pc.pro_id=$1
      JOIN professionals p ON p.user_id=$1 AND p.verification_status<>'rejected'
      WHERE r.status='open' AND r.expires_at>now()
      AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.request_id=r.id AND l.pro_id=$1)
      ORDER BY r.created_at DESC LIMIT 20`,[user.id]);
    for(const request of requests)await this.market.match(Number(request.id));
    return this.market.leads(user);
  }
  @Post('leads/:id/unlock') async unlock(@Req() req: Request,@Param('id') id:string,@Headers('idempotency-key') key:unknown) { return this.market.unlock(await this.auth.current(req,['pro']),idSchema.parse(id),keySchema.parse(key)); }
  @Patch('leads/:id/status') async leadStatus(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) { const user=await this.auth.current(req,['pro']);const {status}=z.object({status:z.enum(['won','lost','ignored'])}).parse(body);const rows=await this.db.query(`UPDATE leads SET status=$1 WHERE id=$2 AND pro_id=$3 AND (($1 IN ('won','lost') AND status IN ('unlocked','won','lost')) OR ($1='ignored' AND status IN ('offered','viewed'))) RETURNING id`,[status,idSchema.parse(id),user.id]);required(rows[0]);return {ok:true}; }
  @Get('pro/wallet') async wallet(@Req() req:Request) { const user=await this.auth.current(req,['pro']); return { balance:Number((await this.db.query('SELECT COALESCE(sum(amount),0) balance FROM coin_transactions WHERE pro_id=$1',[user.id]))[0].balance), transactions:await this.db.query('SELECT id,type,amount,balance_after,created_at FROM coin_transactions WHERE pro_id=$1 ORDER BY id DESC LIMIT 50',[user.id]),payments:await this.db.query('SELECT id,status,amount_cents,coins,method FROM payments WHERE pro_id=$1 ORDER BY id DESC LIMIT 20',[user.id]) }; }
  @Post('pro/wallet/purchase') async purchase(@Req() req:Request,@Body() body:unknown,@Headers('idempotency-key') key:unknown) {
    const user=await this.auth.current(req,['pro']);const input=purchaseSchema.parse(body);const idempotency=keySchema.parse(key);
    if(config.DEMO_MODE!=='true') fail('GATEWAY_NOT_CONFIGURED','O gateway de pagamento ainda não está configurado.',503);
    return this.db.transaction(async tx=>{
      const existing=(await tx.query('SELECT * FROM payments WHERE idempotency_key=$1 FOR UPDATE',[idempotency]))[0]; if(existing){if(Number(existing.pro_id)!==user.id || Number(existing.package_id)!==input.packageId || existing.method!==input.method)fail('IDEMPOTENCY_CONFLICT','Chave usada em outra operação.',409);return existing;}
      const pack=required((await tx.query('SELECT * FROM coin_packages WHERE id=$1 AND is_active',[input.packageId]))[0]);
      return (await tx.query("INSERT INTO payments(pro_id,package_id,method,amount_cents,coins,gateway,gateway_ref,idempotency_key) VALUES ($1,$2,$3,$4,$5,'demo',$6,$7) RETURNING id,status,amount_cents,coins,method",[user.id,pack.id,input.method,pack.price_cents,pack.coins,randomUUID(),idempotency]))[0];
    });
  }
  @Post('payments/:id/demo-confirm') async confirm(@Req() req:Request,@Param('id') id:string) {if(config.DEMO_MODE!=='true')fail('NOT_FOUND','Indisponível.',404);const user=await this.auth.current(req,['pro']);const payment=required((await this.db.query("SELECT * FROM payments WHERE id=$1 AND pro_id=$2 AND gateway='demo'",[idSchema.parse(id),user.id]))[0]);return this.market.settlePayment(Number(payment.id),String(payment.gateway_ref));}
  @Post('reviews') async review(@Req() req:Request,@Body() body:unknown) {const user=await this.auth.current(req,['client']);const input=reviewSchema.parse(body);const lead=required((await this.db.query("SELECT l.pro_id FROM leads l JOIN requests r ON r.id=l.request_id WHERE l.id=$1 AND r.client_id=$2 AND l.status IN ('unlocked','won')",[input.leadId,user.id]))[0]);await this.db.query('INSERT INTO reviews(lead_id,client_id,pro_id,rating,comment) VALUES ($1,$2,$3,$4,$5)',[input.leadId,user.id,lead.pro_id,input.rating,input.comment]);return {message:'Avaliação enviada para moderação.'};}
  @Get('professionals/:id') async publicProfile(@Param('id') id:string) {const pro=required((await this.db.query("SELECT u.id,u.name,p.bio,p.rating_avg,p.rating_count,p.verification_status FROM professionals p JOIN users u ON u.id=p.user_id WHERE u.id=$1 AND u.status='active'",[idSchema.parse(id)]))[0]);return {...pro,reviews:await this.db.query("SELECT rating,comment,pro_reply FROM reviews WHERE pro_id=$1 AND status='published' ORDER BY created_at DESC LIMIT 50",[id])};}
  @Post('reviews/:id/reply') async reply(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const user=await this.auth.current(req,['pro']);const {reply}=z.object({reply:z.string().trim().min(5).max(600)}).parse(body);required((await this.db.query("UPDATE reviews SET pro_reply=$1 WHERE id=$2 AND pro_id=$3 AND status='published' RETURNING id",[reply,idSchema.parse(id),user.id]))[0]);return {ok:true};}
  @Get('pro/reviews') async proReviews(@Req() req:Request) {const user=await this.auth.current(req,['pro']);return this.db.query("SELECT id,rating,comment,pro_reply,created_at FROM reviews WHERE pro_id=$1 AND status='published' ORDER BY created_at DESC LIMIT 50",[user.id]);}
  @Post('leads/:id/refund') async refund(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const user=await this.auth.current(req,['pro']);const {reason}=z.object({reason:z.string().trim().min(15).max(600)}).parse(body);required((await this.db.query("SELECT id FROM leads WHERE id=$1 AND pro_id=$2 AND status IN ('unlocked','lost','won')",[idSchema.parse(id),user.id]))[0]);await this.db.query('INSERT INTO refund_requests(lead_id,reason) VALUES ($1,$2)',[id,reason]);return {message:'Solicitação enviada para análise.'};}
  @Get('notifications') async notifications(@Req() req:Request) {const user=await this.auth.current(req);return this.db.query('SELECT id,template,payload,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[user.id]);}
  @Patch('notifications/read') async readNotifications(@Req() req:Request) {const user=await this.auth.current(req);await this.db.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[user.id]);return {ok:true};}
  @Get('admin/overview') async admin(@Req() req:Request) {await this.auth.current(req,['admin']);return {metrics:(await this.db.query("SELECT (SELECT count(*) FROM requests) requests,(SELECT count(*) FROM professionals) professionals,(SELECT COALESCE(sum(amount_cents),0) FROM payments WHERE status='paid') revenue,(SELECT count(*) FROM leads WHERE status IN ('unlocked','won','lost')) unlocks"))[0],refunds:await this.db.query("SELECT f.id,f.reason,f.status,l.coin_cost,u.name FROM refund_requests f JOIN leads l ON l.id=f.lead_id JOIN users u ON u.id=l.pro_id WHERE f.status='pending'"),reviews:await this.db.query("SELECT v.id,v.rating,v.comment,u.name FROM reviews v JOIN users u ON u.id=v.pro_id WHERE v.status='pending'"),professionals:await this.db.query("SELECT p.user_id id,p.document_type,p.document_number,u.name FROM professionals p JOIN users u ON u.id=p.user_id WHERE p.verification_status='pending'"),pricing:await this.db.query('SELECT p.id,p.service_id,p.coin_cost,s.name FROM lead_pricing_rules p JOIN services s ON s.id=p.service_id WHERE p.valid_to IS NULL ORDER BY s.name'),services:await this.db.query('SELECT id,name,is_active FROM services ORDER BY name')};}
  @Post('admin/refunds/:id/resolve') async resolveRefund(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const {approved}=z.object({approved:z.boolean()}).parse(body);return this.market.approveRefund(await this.auth.current(req,['admin']),idSchema.parse(id),approved);}
  @Post('admin/reviews/:id/moderate') async moderate(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const actor=await this.auth.current(req,['admin']);const {published}=z.object({published:z.boolean()}).parse(body);await this.db.transaction(async tx=>{const review=required((await tx.query('UPDATE reviews SET status=$1 WHERE id=$2 RETURNING pro_id',[published?'published':'removed',idSchema.parse(id)]))[0]);await tx.query("UPDATE professionals SET rating_avg=COALESCE((SELECT avg(rating) FROM reviews WHERE pro_id=$1 AND status='published'),0),rating_count=(SELECT count(*) FROM reviews WHERE pro_id=$1 AND status='published') WHERE user_id=$1",[review.pro_id]);await this.market.audit(tx,actor.id,'review.moderate','review',Number(id),{published});});return {ok:true};}
  @Post('admin/professionals/:id/verify') async verifyPro(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const actor=await this.auth.current(req,['admin']);const {approved}=z.object({approved:z.boolean()}).parse(body);await this.db.transaction(async tx=>{required((await tx.query('UPDATE professionals SET verification_status=$1 WHERE user_id=$2 RETURNING user_id',[approved?'verified':'rejected',idSchema.parse(id)]))[0]);await this.market.audit(tx,actor.id,'professional.verify','professional',Number(id),{approved});});return {ok:true};}
  @Patch('admin/pricing/:id') async pricing(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const actor=await this.auth.current(req,['admin']);const {cost}=z.object({cost:z.number().int().positive().max(10000)}).parse(body);await this.db.transaction(async tx=>{const row=required((await tx.query('SELECT * FROM lead_pricing_rules WHERE id=$1 FOR UPDATE',[idSchema.parse(id)]))[0]);if(row.valid_to)fail('PRICING_EXPIRED','Regra já substituída.',409);await tx.query('UPDATE lead_pricing_rules SET valid_to=now() WHERE id=$1',[id]);await tx.query('INSERT INTO lead_pricing_rules(service_id,city_id,coin_cost) VALUES ($1,$2,$3)',[row.service_id,row.city_id,cost]);await this.market.audit(tx,actor.id,'pricing.update','pricing',Number(id),{cost});});return {ok:true};}
  @Patch('admin/services/:id') async toggleService(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {const actor=await this.auth.current(req,['admin']);const {active}=z.object({active:z.boolean()}).parse(body);required((await this.db.query('UPDATE services SET is_active=$1 WHERE id=$2 RETURNING id',[active,idSchema.parse(id)]))[0]);await this.market.audit(this.db,actor.id,'service.toggle','service',Number(id),{active});return {ok:true};}
  @Delete('auth/account') async deleteAccount(@Req() req:Request) {const user=await this.auth.current(req);await this.db.transaction(async tx=>{await tx.query("UPDATE users SET status='deleted',city_id=NULL,neighborhood='',name='Conta excluída',email=$1,phone=$2,password_hash='deleted' WHERE id=$3",[`deleted-${user.id}@elo.invalid`,`deleted-${user.id}`,user.id]);await tx.query('DELETE FROM refresh_sessions WHERE user_id=$1',[user.id]);await tx.query("UPDATE requests SET status='cancelled',description='Conteúdo removido' WHERE client_id=$1",[user.id]);await tx.query("UPDATE professionals SET bio=NULL,document_number=$1,photo_url=NULL WHERE user_id=$2",[`deleted-${user.id}`,user.id]);await tx.query('DELETE FROM phone_challenges WHERE user_id=$1',[user.id]);await tx.query('DELETE FROM notifications WHERE user_id=$1',[user.id]);await tx.query('DELETE FROM request_answers WHERE request_id IN (SELECT id FROM requests WHERE client_id=$1)',[user.id]);await tx.query("UPDATE reviews SET comment=NULL,pro_reply=NULL WHERE client_id=$1 OR pro_id=$1",[user.id]);});return {ok:true};}
}
