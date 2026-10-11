import { hash, verify } from 'argon2';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Database } from './database';
import { config, jwtSecret } from './config';
import { fail, required } from './errors';
import type { User } from '../../../packages/shared/src';
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export class Auth {
  constructor(readonly db: Database) {}
  async current(req: Request, roles?: User['role'][]): Promise<User> {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) fail('UNAUTHORIZED', 'Entre na sua conta para continuar.', 401);
    let id: number;
    try { const payload = z.object({ sub: z.string(), purpose: z.literal('access') }).parse(jwt.verify(token, jwtSecret)); id = Number(payload.sub); }
    catch { fail('UNAUTHORIZED', 'Sessão expirada. Entre novamente.', 401); }
    const row = (await this.db.query('SELECT id,name,role,phone_verified_at FROM users WHERE id=$1 AND status=\'active\'', [id]))[0];
    if (!row) fail('UNAUTHORIZED', 'Conta indisponível.', 401);
    const user: User = { id: Number(row.id), name: String(row.name), role: row.role as User['role'], phoneVerified: Boolean(row.phone_verified_at) };
    if (roles && !roles.includes(user.role)) fail('FORBIDDEN', 'Seu perfil não possui acesso a esta ação.', 403);
    return user;
  }
  async session(userId: number, res: Response) {
    const user = required((await this.db.query('SELECT id,name,role,phone_verified_at FROM users WHERE id=$1 AND status=\'active\'', [userId]))[0]);
    const id = randomUUID(), secret = randomBytes(40).toString('hex');
    await this.db.query("INSERT INTO refresh_sessions VALUES ($1,$2,$3,now()+interval '30 days')", [id, userId, digest(secret)]);
    res.cookie('elo_refresh', `${id}.${secret}`, { httpOnly: true, sameSite: 'strict', secure: config.NODE_ENV === 'production', path: '/v1/auth', maxAge: 30*86400000 });
    return { user: { id: Number(user.id), name: user.name, role: user.role, phoneVerified: Boolean(user.phone_verified_at) }, token: jwt.sign({ purpose: 'access' }, jwtSecret, { subject: String(userId), expiresIn: '15m' }) };
  }
  async refresh(req: Request, res: Response) {
    this.checkOrigin(req);
    const cookie = z.string().safeParse((req.cookies as Record<string, unknown>).elo_refresh);
    if (!cookie.success) fail('UNAUTHORIZED', 'Entre na sua conta.', 401);
    const [id, secret] = cookie.data.split('.');
    if (!z.uuid().safeParse(id).success || !secret) fail('UNAUTHORIZED', 'Sessão inválida.', 401);
    const session = await this.db.transaction(async tx => {
      const row = (await tx.query('SELECT * FROM refresh_sessions WHERE id=$1 AND expires_at>now() FOR UPDATE', [id]))[0];
      if (!row || row.token_hash !== digest(secret)) fail('UNAUTHORIZED', 'Sessão expirada.', 401);
      await tx.query('DELETE FROM refresh_sessions WHERE id=$1', [id]); return row;
    });
    return this.session(Number(session.user_id), res);
  }
  checkOrigin(req: Request) { if (req.headers.origin !== config.WEB_ORIGIN) fail('INVALID_ORIGIN', 'Origem não autorizada.', 403); }
  async issueOtp(userId: number) {
    if (config.DEMO_MODE !== 'true') fail('SMS_NOT_CONFIGURED', 'A verificação por SMS ainda não está configurada.', 503);
    const code = String(randomInt(100000, 999999));
    await this.db.query("INSERT INTO phone_challenges(user_id,code_hash,expires_at) VALUES ($1,$2,now()+interval '5 minutes') ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0", [userId, await hash(code)]);
    return { demoCode: code, message: 'Código de teste local. Nenhum SMS foi enviado.' };
  }
  async verifyOtp(userId: number, code: string) {
    await this.db.transaction(async tx => {
      const row = (await tx.query('SELECT * FROM phone_challenges WHERE user_id=$1 FOR UPDATE', [userId]))[0];
      if (!row || Number(row.attempts) >= 5 || new Date(String(row.expires_at)).getTime() < Date.now()) fail('OTP_EXPIRED', 'Solicite um novo código.', 409);
      await tx.query('UPDATE phone_challenges SET attempts=attempts+1 WHERE user_id=$1', [userId]);
    });
    const row = required((await this.db.query('SELECT code_hash FROM phone_challenges WHERE user_id=$1', [userId]))[0]);
    if (!(await verify(String(row.code_hash), code))) fail('OTP_INVALID', 'Código incorreto.');
    await this.db.transaction(async tx => { await tx.query('UPDATE users SET phone_verified_at=now() WHERE id=$1', [userId]); await tx.query('DELETE FROM phone_challenges WHERE user_id=$1', [userId]); });
    return { verified: true };
  }
}
