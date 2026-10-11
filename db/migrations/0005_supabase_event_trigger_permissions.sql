-- Supabase may install a public event trigger function with browser grants.
-- It runs from the DDL event trigger; application/browser execution is unnecessary.
DO $permissions$
DECLARE browser_role TEXT;
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I',browser_role);
    END LOOP;
  END IF;
END;
$permissions$;
