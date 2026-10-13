import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Database, type Row } from '../apps/api/src/database';
import { config } from '../apps/api/src/config';
import { sqlIdentifier } from '../apps/api/src/postgres-options';

// Owner-only operation. Never replace an existing schema or copy active sessions.
async function main() {
  const source = 'elo';
  const destination = process.argv[2];
  if (config.DATABASE_MODE !== 'postgres' || !destination?.endsWith('_demo')) throw new Error('Use PostgreSQL e um novo schema com sufixo _demo.');
  sqlIdentifier(destination);
  const sourceDb = new Database('postgres', config.DATA_DIR, { schema: source, migrate: false, runtimeRole: '' });
  const targetDb = new Database('postgres', config.DATA_DIR, { schema: destination, migrate: true, runtimeRole: '' });
  try {
    await sourceDb.initialize();
    if ((await sourceDb.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [destination])).length) throw new Error('O destino já existe; não será sobrescrito.');
    const snapshot = await sourceDb.transaction(async tx => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const tables = await tx.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [source]);
      const data: Record<string, Row[]> = {};
      for (const { tablename } of tables) data[tablename] = (await tx.query<{ record: Row }>(`SELECT to_jsonb(t) record FROM ${sqlIdentifier(source)}.${sqlIdentifier(tablename)} t`)).map(row => row.record);
      const dependencies = await tx.query<{ child: string; parent: string }>(`SELECT child.relname child,parent.relname parent FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace JOIN pg_class parent ON parent.oid=fk.confrelid WHERE fk.contype='f' AND n.nspname=$1 AND fk.conrelid<>fk.confrelid`, [source]);
      return { source, data, dependencies };
    });
    const json = JSON.stringify(snapshot);
    const digest = createHash('sha256').update(json).digest('hex');
    await mkdir('.data/backups', { recursive: true });
    const backup = `.data/backups/${source}-${destination}-${Date.now()}.json`;
    await writeFile(backup, json, { mode: 0o600, flag: 'wx' });
    await targetDb.initialize();
    const excluded = new Set(['schema_migrations', 'wallets', 'refresh_sessions', 'phone_challenges']);
    const remaining = new Set(Object.keys(snapshot.data).filter(table => !excluded.has(table)));
    const order: string[] = [];
    while (remaining.size) {
      const ready = [...remaining].filter(table => !snapshot.dependencies.some(dep => dep.child === table && remaining.has(dep.parent)));
      if (!ready.length) throw new Error('Dependência circular exige importação específica.');
      for (const table of ready) { order.push(table); remaining.delete(table); }
    }
    await targetDb.transaction(async tx => {
      await tx.query("SET LOCAL statement_timeout='120s'");
      // Only this newly created schema contains seed data. No existing schema is truncated.
      const qualified = (table: string) => `${sqlIdentifier(destination)}.${sqlIdentifier(table)}`;
      const targetTables = await tx.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename<>$2', [destination, 'schema_migrations']);
      await tx.query(`TRUNCATE ${targetTables.map(row => qualified(row.tablename)).join(',')} RESTART IDENTITY`);
      for (const table of order) {
        const records = snapshot.data[table];
        if (!records.length) continue;
        await tx.query(`INSERT INTO ${qualified(table)} OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::${qualified(table)},$1::jsonb)${table === 'coin_transactions' ? ' ORDER BY id' : ''}`, [JSON.stringify(records)]);
        const [comparison] = await tx.query(`SELECT count(*)::int mismatches FROM ((SELECT to_jsonb(t) value FROM ${qualified(table)} t EXCEPT SELECT value FROM jsonb_array_elements($1::jsonb)) UNION ALL (SELECT value FROM jsonb_array_elements($1::jsonb) EXCEPT SELECT to_jsonb(t) FROM ${qualified(table)} t)) differences`, [JSON.stringify(records)]);
        // PostgreSQL normalizes timestamps; compare typed records to avoid formatting differences.
        if (Number(comparison.mismatches)) {
          const [typed] = await tx.query(`SELECT count(*)::int mismatches FROM ((SELECT * FROM ${qualified(table)} EXCEPT SELECT * FROM jsonb_populate_recordset(NULL::${qualified(table)},$1::jsonb)) UNION ALL (SELECT * FROM jsonb_populate_recordset(NULL::${qualified(table)},$1::jsonb) EXCEPT SELECT * FROM ${qualified(table)})) differences`, [JSON.stringify(records)]);
          if (Number(typed.mismatches)) throw new Error(`Diferenças na tabela ${table}; cópia revertida.`);
        }
      }
      // Rebuild cached wallets only through the ledger; preserve zero-balance professionals.
      await tx.query(`INSERT INTO ${qualified('wallets')} (pro_id) SELECT user_id FROM ${qualified('professionals')} ON CONFLICT DO NOTHING`);
      const balances = await tx.query<{ pro_id: number; balance: number }>(`SELECT pro_id,balance FROM ${qualified('wallets')}`);
      if (balances.length !== snapshot.data.wallets.length || balances.some(wallet => !snapshot.data.wallets.some(old => Number(old.pro_id) === Number(wallet.pro_id) && Number(old.balance) === Number(wallet.balance)))) throw new Error('Saldos divergentes; cópia revertida.');
      const [slots] = await tx.query(`SELECT count(*)::int mismatches FROM ${qualified('requests')} r WHERE unlocked_count<>(SELECT count(*) FROM ${qualified('coin_transactions')} c JOIN ${qualified('leads')} l ON l.id=c.lead_id WHERE l.request_id=r.id AND c.type='unlock')`);
      if (Number(slots.mismatches)) throw new Error('Desbloqueios divergentes; cópia revertida.');
      const sequences = await tx.query<{ table_name: string; column_name: string }>(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1 AND (is_identity='YES' OR column_default LIKE 'nextval(%')`, [destination]);
      for (const column of sequences) await tx.query(`SELECT setval(pg_get_serial_sequence($1,$2),COALESCE(max(${sqlIdentifier(column.column_name)}),1),count(*)>0) FROM ${qualified(column.table_name)}`, [`${destination}.${column.table_name}`, column.column_name]);
      await tx.query(`INSERT INTO ${qualified('audit_logs')}(action,entity,diff) VALUES ('database.demo_snapshot','database',$1)`, [JSON.stringify({ source, destination, digest, excluded: ['refresh_sessions', 'phone_challenges'], copiedTables: order.length })]);
    });
    console.log(JSON.stringify({ source, destination, backup, copiedTables: order.length, counts: Object.fromEntries(order.map(table => [table, snapshot.data[table].length])), balancesVerified: true, sessionsCopied: false }, null, 2));
  } finally { await sourceDb.close(); await targetDb.close(); }
}
main().catch(error => { console.error(`Cópia não concluída (${typeof error === 'object' && error && 'code' in error ? String(error.code) : error instanceof Error ? error.message : 'erro interno'}).`); process.exitCode = 1; });
