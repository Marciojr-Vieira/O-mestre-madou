-- Elo has its own authentication in NestJS. Supabase Data API roles receive no access.
-- The API can SET ROLE elo_runtime; migration credentials remain separate.
DO $security$
DECLARE
  schema_name TEXT := current_schema();
  table_name TEXT;
  api_role TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='elo_runtime') THEN
    CREATE ROLE elo_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO elo_runtime',schema_name);
  IF current_user <> 'elo_runtime' THEN
    EXECUTE format('GRANT elo_runtime TO %I',current_user);
  END IF;
  IF schema_name <> 'public' THEN
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC',schema_name);
  END IF;

  FOREACH table_name IN ARRAY ARRAY['users','professionals','states','cities','categories','services','service_questions','professional_services','professional_coverage','requests','request_answers','request_attachments','leads','lead_pricing_rules','coin_packages','payments','wallets','coin_transactions','reviews','refund_requests','reports','notifications','audit_logs','refresh_sessions','phone_challenges','idempotent_results','fixed_price_offers','schema_migrations'] LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',schema_name,table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC',schema_name,table_name);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I',schema_name,table_name,api_role);
    END LOOP;
    EXECUTE format('CREATE POLICY elo_backend ON %I.%I TO elo_runtime USING (true) WITH CHECK (true)',schema_name,table_name);
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO elo_runtime',schema_name,table_name);
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['users','professionals','professional_services','professional_coverage','requests','request_answers','leads','payments','reviews','refund_requests','notifications','refresh_sessions','phone_challenges','idempotent_results','fixed_price_offers','audit_logs','coin_transactions'] LOOP
    EXECUTE format('GRANT INSERT ON TABLE %I.%I TO elo_runtime',schema_name,table_name);
  END LOOP;
  EXECUTE format('GRANT INSERT (pro_id), UPDATE (updated_at) ON TABLE %I.wallets TO elo_runtime',schema_name);
  EXECUTE format('GRANT UPDATE (token_hash) ON TABLE %I.refresh_sessions TO elo_runtime',schema_name);
  FOREACH table_name IN ARRAY ARRAY['users','professionals','services','lead_pricing_rules','requests','leads','payments','reviews','refund_requests','notifications','phone_challenges','fixed_price_offers'] LOOP
    EXECUTE format('GRANT UPDATE ON TABLE %I.%I TO elo_runtime',schema_name,table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['professional_services','professional_coverage','refresh_sessions','phone_challenges','fixed_price_offers','notifications','request_answers'] LOOP
    EXECUTE format('GRANT DELETE ON TABLE %I.%I TO elo_runtime',schema_name,table_name);
  END LOOP;
  -- Only the ledger trigger may update the cached balance.
  EXECUTE format('ALTER FUNCTION %I.apply_coin_transaction() SECURITY DEFINER',schema_name);
  EXECUTE format('ALTER FUNCTION %I.apply_coin_transaction() SET search_path = %I, pg_catalog',schema_name,schema_name);
  EXECUTE format('ALTER FUNCTION %I.forbid_ledger_mutation() SET search_path = %I, pg_catalog',schema_name,schema_name);
  EXECUTE format('REVOKE ALL ON FUNCTION %I.apply_coin_transaction() FROM PUBLIC',schema_name);
  EXECUTE format('REVOKE ALL ON FUNCTION %I.forbid_ledger_mutation() FROM PUBLIC',schema_name);
  -- Identity sequences need USAGE, never ownership or setval access.
  FOR table_name IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=schema_name AND c.relkind='S' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC',schema_name,table_name);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM %I',schema_name,table_name,api_role);
    END LOOP;
    EXECUTE format('GRANT USAGE ON SEQUENCE %I.%I TO elo_runtime',schema_name,table_name);
  END LOOP;
END;
$security$;
