import type { Database, Executor, Row } from './database';
import { fail, required } from './errors';
import type { User } from '../../../packages/shared/src';
type RequestRow = Row & { id: number; status: string; unlocked_count: number; max_leads: number; expires_at: Date };
type LeadRow = Row & { id: number; pro_id: number; request_id: number; coin_cost: number; status: string };
export class Marketplace {
  constructor(readonly db: Database) {}
  async expire() { await this.db.query("UPDATE requests SET status='expired' WHERE status='open' AND expires_at<=now()"); }
  async match(requestId: number) {
    await this.db.transaction(async tx => {
      const request = required((await tx.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE', [requestId]))[0]);
      if (request.status !== 'open') return;
      const price = (await tx.query<{ coin_cost: number }>(`SELECT coin_cost FROM lead_pricing_rules WHERE service_id=$1 AND (city_id=$2 OR city_id IS NULL) AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now()) ORDER BY city_id IS NULL, valid_from DESC LIMIT 1`, [request.service_id, request.city_id]))[0];
      if (!price || price.coin_cost <= 0) fail('PRICING_MISSING', 'Este serviço ainda não possui preço de lead configurado.', 503);
      const pros = await tx.query<{ user_id: number }>(`SELECT p.user_id FROM professionals p JOIN users u ON u.id=p.user_id JOIN professional_services ps ON ps.pro_id=p.user_id JOIN professional_coverage pc ON pc.pro_id=p.user_id WHERE ps.service_id=$1 AND pc.city_id=$2 AND u.status='active' AND p.verification_status<>'rejected' ORDER BY p.rating_avg DESC,p.user_id LIMIT 20`, [request.service_id, request.city_id]);
      for (const pro of pros) {
        const inserted = await tx.query(`INSERT INTO leads (request_id,pro_id,coin_cost) VALUES ($1,$2,$3) ON CONFLICT (request_id,pro_id) DO NOTHING RETURNING id`, [requestId, pro.user_id, price.coin_cost]);
        if (inserted.length) await this.notify(tx, pro.user_id, 'new-lead', { requestId });
      }
    });
  }
  async unlock(user: User, leadId: number, key: string) {
    return this.db.transaction(async tx => {
      const replay = (await tx.query('SELECT * FROM idempotent_results WHERE key=$1', [key]))[0];
      if (replay) { if (Number(replay.actor_id) !== user.id || replay.operation !== 'unlock' || Number(replay.resource_id) !== leadId) fail('IDEMPOTENCY_CONFLICT', 'Chave usada em outra operação.', 409); return this.contact(tx, user.id, leadId); }
      const preliminary = required((await tx.query<LeadRow>('SELECT * FROM leads WHERE id=$1 AND pro_id=$2', [leadId, user.id]))[0]);
      const request = required((await tx.query<RequestRow>('SELECT * FROM requests WHERE id=$1 FOR UPDATE', [preliminary.request_id]))[0]);
      const lead = required((await tx.query<LeadRow>('SELECT * FROM leads WHERE id=$1 AND pro_id=$2 FOR UPDATE', [leadId, user.id]))[0]);
      if (['unlocked','won','lost'].includes(lead.status)) return this.contact(tx, user.id, leadId);
      if (request.status !== 'open' || request.unlocked_count >= request.max_leads || new Date(request.expires_at).getTime() <= Date.now()) fail('REQUEST_FULL', 'O pedido foi encerrado ou expirou.', 409);
      if (!['offered','viewed'].includes(lead.status)) fail('LEAD_UNAVAILABLE', 'Contato indisponível.', 409);
      const verified = required((await tx.query("SELECT p.verification_status,u.phone_verified_at FROM professionals p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1", [user.id]))[0]);
      if (verified.verification_status !== 'verified' || !verified.phone_verified_at) fail('VERIFICATION_REQUIRED', 'Verifique seu telefone e aguarde a aprovação do cadastro.', 403);
      await tx.query('INSERT INTO wallets (pro_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
      const wallet = required((await tx.query<{ balance: number }>('SELECT balance FROM wallets WHERE pro_id=$1 FOR UPDATE', [user.id]))[0]);
      if (wallet.balance < lead.coin_cost) fail('INSUFFICIENT_COINS', 'Você precisa de mais moedas para liberar este contato.', 409);
      await tx.query("INSERT INTO coin_transactions (pro_id,type,amount,lead_id,idempotency_key) VALUES ($1,'unlock',$2,$3,$4)", [user.id, -lead.coin_cost, leadId, `unlock:${user.id}:${key}`]);
      await tx.query("UPDATE leads SET status='unlocked',unlocked_at=now() WHERE id=$1", [leadId]);
      await tx.query("UPDATE requests SET unlocked_count=unlocked_count+1,status=CASE WHEN unlocked_count+1>=max_leads THEN 'closed'::request_status ELSE status END WHERE id=$1", [request.id]);
      await tx.query("INSERT INTO idempotent_results (key,actor_id,operation,resource_id) VALUES ($1,$2,'unlock',$3)", [key, user.id, leadId]);
      await this.notify(tx, Number(request.client_id), 'contact-unlocked', { requestId: request.id, proId: user.id });
      return this.contact(tx, user.id, leadId);
    });
  }
  async contact(tx: Executor, proId: number, leadId: number) {
    const contact = (await tx.query(`SELECT u.name,u.phone,u.email FROM leads l JOIN requests r ON r.id=l.request_id JOIN users u ON u.id=r.client_id WHERE l.id=$1 AND l.pro_id=$2 AND l.status IN ('unlocked','won','lost')`, [leadId, proId]))[0];
    return required(contact, 'CONTACT_LOCKED', 'Contato bloqueado.');
  }
  async leads(user: User) {
    await this.expire();
    const leads = await this.db.query(`SELECT l.id,l.request_id,l.status,l.coin_cost,r.status request_status,r.description,r.urgency,r.unlocked_count,r.max_leads,r.created_at,s.name service,c.name city,f.status refund_status FROM leads l JOIN requests r ON r.id=l.request_id JOIN services s ON s.id=r.service_id JOIN cities c ON c.id=r.city_id LEFT JOIN refund_requests f ON f.lead_id=l.id WHERE l.pro_id=$1 ORDER BY l.offered_at DESC LIMIT 50`, [user.id]);
    for (const lead of leads) {
      lead.answers = await this.db.query('SELECT q.label,a.value FROM request_answers a JOIN service_questions q ON q.id=a.question_id WHERE a.request_id=$1 ORDER BY q.position', [lead.request_id]);
      if (['unlocked','won','lost'].includes(String(lead.status))) lead.contact = await this.contact(this.db, user.id, Number(lead.id));
    }
    return leads;
  }
  async settlePayment(paymentId: number, gatewayRef: string) {
    return this.db.transaction(async tx => {
      const payment = required((await tx.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [paymentId]))[0]);
      if (payment.gateway_ref !== gatewayRef) fail('PAYMENT_REFERENCE', 'Referência inválida.', 409);
      if (payment.status === 'paid') return payment;
      if (payment.status !== 'pending') fail('PAYMENT_STATE', 'Pagamento indisponível.', 409);
      await tx.query("INSERT INTO coin_transactions (pro_id,type,amount,payment_id,idempotency_key) VALUES ($1,'purchase',$2,$3,$4)", [payment.pro_id, payment.coins, paymentId, `payment:${payment.gateway}:${gatewayRef}`]);
      await tx.query("UPDATE payments SET status='paid',paid_at=now() WHERE id=$1", [paymentId]);
      await this.notify(tx, Number(payment.pro_id), 'coins-purchased', { paymentId, coins: payment.coins });
      return { ...payment, status: 'paid' };
    });
  }
  async approveRefund(actor: User, refundId: number, approve: boolean) {
    return this.db.transaction(async tx => {
      const refund = required((await tx.query('SELECT * FROM refund_requests WHERE id=$1 FOR UPDATE', [refundId]))[0]);
      if (refund.status !== 'pending') return refund;
      const lead = required((await tx.query<LeadRow>('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [refund.lead_id]))[0]);
      if (approve) {
        await tx.query("INSERT INTO coin_transactions (pro_id,type,amount,lead_id,idempotency_key) VALUES ($1,'refund',$2,$3,$4)", [lead.pro_id, lead.coin_cost, lead.id, `refund:${refundId}`]);
        await tx.query("UPDATE leads SET status='refunded' WHERE id=$1", [lead.id]);
      }
      await tx.query('UPDATE refund_requests SET status=$1,resolved_by=$2 WHERE id=$3', [approve ? 'approved' : 'rejected', actor.id, refundId]);
      await this.audit(tx, actor.id, 'refund.resolve', 'refund', refundId, { approved: approve });
      return { status: approve ? 'approved' : 'rejected' };
    });
  }
  async notify(tx: Executor, userId: number, template: string, payload: Row) { await tx.query("INSERT INTO notifications (user_id,channel,template,payload) VALUES ($1,'email',$2,$3)", [userId, template, JSON.stringify(payload)]); }
  async audit(tx: Executor, actor: number, action: string, entity: string, id: number, diff: Row) { await tx.query('INSERT INTO audit_logs (actor_id,action,entity,entity_id,diff) VALUES ($1,$2,$3,$4,$5)', [actor, action, entity, id, JSON.stringify(diff)]); }
}
