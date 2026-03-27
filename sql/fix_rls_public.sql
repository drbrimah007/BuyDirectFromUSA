-- ================================================================
-- BuyDirectFromUSA — Fix RLS and grants for public (anon) RFQ form
-- The landing page RFQ form submits without login.
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- ================================================================

-- 1. Schema-level grants: anon must have USAGE on schema + table-level INSERT/SELECT
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON TABLE public.deals TO anon;
GRANT SELECT ON TABLE public.categories TO anon;
GRANT SELECT ON TABLE public.countries TO anon;

-- 2. Categories: allow anon to read (form dropdowns)
DROP POLICY IF EXISTS cat_read ON categories;
CREATE POLICY cat_read ON categories
  FOR SELECT TO authenticated, anon
  USING (true);

-- 3. Countries: allow anon to read (form dropdowns)
DROP POLICY IF EXISTS country_read ON countries;
CREATE POLICY country_read ON countries
  FOR SELECT TO authenticated, anon
  USING (true);

-- 4. Deals INSERT: allow anon to insert (public RFQ form)
--    anon gets INSERT only — no SELECT, UPDATE, or DELETE.
--    The JS layer must NOT call .select() after insert for anon users
--    because there is intentionally no SELECT policy for anon on deals.
DROP POLICY IF EXISTS deals_insert ON deals;
CREATE POLICY deals_insert ON deals
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- Existing authenticated policies are left untouched:
--   deals_admin  — operators/admins full access
--   deals_client — clients read their own deals
