import { config } from './config';
import type { Executor } from './database';
import type { DemoSettings } from '../../../packages/shared/src';
export async function demoSettings(db:Executor):Promise<DemoSettings> {
  const [row]=await db.query('SELECT demo_login_enabled FROM application_settings WHERE singleton=true');
  const enabled=row?.demo_login_enabled===true,available=demoAvailable();
  return {enabled,available,effective:enabled&&available};
}
export function demoAvailable() {
  return config.DEMO_MODE==='true'&&(config.DATABASE_MODE==='embedded'||config.DATABASE_SCHEMA.endsWith('_demo')||config.NODE_ENV==='test');
}
