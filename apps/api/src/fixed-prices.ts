import type { Database } from './database';
import { fail, required } from './errors';
import type { FixedPriceInput } from '../../../packages/shared/src';

export class FixedPrices {
  constructor(private db: Database) {}

  publicList() {
    return this.db.query(`SELECT f.id,f.title,f.description,f.price_cents "priceCents",f.unit,
      f.service_id "serviceId",f.city_id "cityId",s.name service,c.name category,ci.name city,
      u.name "professionalName",p.rating_avg rating,p.rating_count "ratingCount"
      FROM fixed_price_offers f JOIN professionals p ON p.user_id=f.pro_id
      JOIN users u ON u.id=p.user_id JOIN services s ON s.id=f.service_id
      JOIN categories c ON c.id=s.category_id JOIN cities ci ON ci.id=f.city_id
      WHERE f.active AND p.fixed_pricing_enabled AND p.verification_status='verified'
      AND u.status='active' AND u.phone_verified_at IS NOT NULL AND s.is_active AND c.is_active
      AND ci.id=1721000
      AND EXISTS(SELECT 1 FROM professional_services ps WHERE ps.pro_id=f.pro_id AND ps.service_id=f.service_id)
      AND EXISTS(SELECT 1 FROM professional_coverage pc WHERE pc.pro_id=f.pro_id AND pc.city_id=f.city_id)
      ORDER BY f.updated_at DESC,f.id DESC`);
  }

  async own(proId: number) {
    const profile = (await this.db.query('SELECT fixed_pricing_enabled enabled,verification_status FROM professionals WHERE user_id=$1', [proId]))[0];
    return { enabled: profile?.enabled ?? false, hasProfile: !!profile, verificationStatus: profile?.verification_status,
      services: (await this.db.query('SELECT service_id FROM professional_services WHERE pro_id=$1', [proId])).map(s => Number(s.service_id)),
      offers: await this.db.query('SELECT id,title,description,price_cents "priceCents",unit,service_id "serviceId",city_id "cityId",active FROM fixed_price_offers WHERE pro_id=$1 ORDER BY id DESC', [proId]) };
  }

  async enable(proId: number, enabled: boolean) {
    required((await this.db.query('UPDATE professionals SET fixed_pricing_enabled=$2 WHERE user_id=$1 RETURNING user_id', [proId, enabled]))[0]);
    return { enabled };
  }

  async save(proId: number, input: FixedPriceInput, id?: number) {
    return this.db.transaction(async tx => {
      required((await tx.query('SELECT user_id FROM professionals WHERE user_id=$1 FOR UPDATE', [proId]))[0]);
      if (id) required((await tx.query('SELECT id FROM fixed_price_offers WHERE id=$1 AND pro_id=$2', [id, proId]))[0]);
      const available = await tx.query(`SELECT s.id FROM services s JOIN categories c ON c.id=s.category_id
        JOIN professional_services ps ON ps.service_id=s.id AND ps.pro_id=$1
        JOIN professional_coverage pc ON pc.pro_id=ps.pro_id AND pc.city_id=$3
        WHERE s.id=$2 AND s.is_active AND c.is_active AND pc.city_id=1721000`, [proId, input.serviceId, input.cityId]);
      if (!available.length) fail('OFFER_COVERAGE_INVALID', 'Escolha um serviço do seu perfil e atendimento em Palmas.');
      const values = [proId, input.serviceId, input.cityId, input.title, input.description, input.priceCents, input.unit, input.active];
      const sql = id
        ? 'UPDATE fixed_price_offers SET service_id=$2,city_id=$3,title=$4,description=$5,price_cents=$6,unit=$7,active=$8,updated_at=now() WHERE pro_id=$1 AND id=$9 RETURNING id'
        : 'INSERT INTO fixed_price_offers(pro_id,service_id,city_id,title,description,price_cents,unit,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id';
      return (await tx.query(sql, id ? [...values, id] : values))[0];
    });
  }

  async remove(proId: number, id: number) {
    required((await this.db.query('DELETE FROM fixed_price_offers WHERE id=$1 AND pro_id=$2 RETURNING id', [id, proId]))[0]);
    return { ok: true };
  }
}
