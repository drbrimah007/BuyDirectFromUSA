-- ═══════════════════════════════════════════════════════════════════
-- BUYDIRECTFROMUSA — DATABASE SCHEMA
-- Sourcing Operations System
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. USERS
CREATE TABLE users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL,
  display_name  text NOT NULL DEFAULT '',
  phone         text DEFAULT '',
  role          text NOT NULL DEFAULT 'client' CHECK (role IN ('admin','operator','client','supplier')),
  company_name  text DEFAULT '',
  country       text DEFAULT '',
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  avatar_url    text DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO users (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. CATEGORIES
CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL UNIQUE,
  slug      text NOT NULL UNIQUE,
  parent_id uuid REFERENCES categories(id),
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Dairy / Milk Powder', 'dairy', 1),
  ('Shelf-Stable Foods', 'shelf-stable', 2),
  ('Feminine Care & Personal Care', 'personal-care', 3),
  ('Medical Consumables', 'medical', 4),
  ('Water, Filters & Emergency Supply', 'water-filters', 5),
  ('Baby Products', 'baby', 6),
  ('Industrial Equipment', 'industrial', 7),
  ('Agriculture & Farming', 'agriculture', 8),
  ('Electronics & Tech', 'electronics', 9),
  ('Automotive Parts', 'automotive', 10),
  ('Chemicals & Raw Materials', 'chemicals', 11),
  ('Textiles & Apparel', 'textiles', 12),
  ('Construction Materials', 'construction', 13),
  ('Other', 'other', 99);

-- 3. COUNTRIES (full list, not limited)
CREATE TABLE countries (
  code    text PRIMARY KEY,
  name    text NOT NULL,
  region  text DEFAULT '',
  notes   text DEFAULT ''
);

INSERT INTO countries (code, name, region) VALUES
  ('SA','Saudi Arabia','GCC'),('AE','UAE','GCC'),('QA','Qatar','GCC'),('KW','Kuwait','GCC'),('BH','Bahrain','GCC'),('OM','Oman','GCC'),
  ('KE','Kenya','Africa'),('NG','Nigeria','Africa'),('GH','Ghana','Africa'),('ZA','South Africa','Africa'),('ET','Ethiopia','Africa'),('TZ','Tanzania','Africa'),('UG','Uganda','Africa'),('EG','Egypt','Africa'),('MA','Morocco','Africa'),('SN','Senegal','Africa'),
  ('GB','United Kingdom','Europe'),('DE','Germany','Europe'),('FR','France','Europe'),('IT','Italy','Europe'),('ES','Spain','Europe'),('NL','Netherlands','Europe'),('BE','Belgium','Europe'),('PL','Poland','Europe'),('SE','Sweden','Europe'),
  ('IN','India','Asia'),('PK','Pakistan','Asia'),('BD','Bangladesh','Asia'),('PH','Philippines','Asia'),('ID','Indonesia','Asia'),('MY','Malaysia','Asia'),('TH','Thailand','Asia'),('VN','Vietnam','Asia'),('JP','Japan','Asia'),('KR','South Korea','Asia'),('CN','China','Asia'),
  ('BR','Brazil','Latin America'),('MX','Mexico','Latin America'),('CO','Colombia','Latin America'),('AR','Argentina','Latin America'),('CL','Chile','Latin America'),('PE','Peru','Latin America'),
  ('CA','Canada','North America'),('US','United States','North America'),
  ('AU','Australia','Oceania'),('NZ','New Zealand','Oceania'),
  ('TR','Turkey','Middle East'),('IQ','Iraq','Middle East'),('JO','Jordan','Middle East'),('LB','Lebanon','Middle East');

-- 4. SUPPLIERS
CREATE TABLE suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  company_name    text NOT NULL,
  contact_name    text DEFAULT '',
  email           text DEFAULT '',
  phone           text DEFAULT '',
  website         text DEFAULT '',
  country         text DEFAULT 'US',
  us_state        text DEFAULT '',
  categories      uuid[] DEFAULT '{}',
  markets_served  text[] DEFAULT '{}',
  certifications  text[] DEFAULT '{}',
  moq_range       text DEFAULT '',
  private_label   boolean NOT NULL DEFAULT false,
  export_ready    boolean NOT NULL DEFAULT true,
  verified        boolean NOT NULL DEFAULT false,
  preferred       boolean NOT NULL DEFAULT false,
  notes           text DEFAULT '',
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_verified ON suppliers(verified);

-- 5. SUPPLIER PRODUCTS
CREATE TABLE supplier_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category_id uuid REFERENCES categories(id),
  description text DEFAULT '',
  moq         text DEFAULT '',
  price_range text DEFAULT '',
  packaging   text DEFAULT '',
  docs_available text[] DEFAULT '{}',
  markets     text[] DEFAULT '{}',
  featured    boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sp_supplier ON supplier_products(supplier_id);
CREATE INDEX idx_sp_category ON supplier_products(category_id);

-- 6. DEALS (the core pipeline)
CREATE TABLE deals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client
  client_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  client_name     text NOT NULL DEFAULT '',
  client_email    text NOT NULL DEFAULT '',
  client_company  text DEFAULT '',
  client_country  text DEFAULT '',
  -- Request details
  request_type    text NOT NULL DEFAULT 'product_sourcing' CHECK (request_type IN (
    'product_sourcing','supplier_match','private_label','bulk_quote','distributor_search','compliance_help','custom'
  )),
  product_needed  text NOT NULL DEFAULT '',
  category_id     uuid REFERENCES categories(id),
  target_country  text DEFAULT '',
  target_region   text DEFAULT '',
  quantity        text DEFAULT '',
  packaging       text DEFAULT '',
  urgency         text DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','urgent')),
  budget_range    text DEFAULT '',
  private_label   boolean NOT NULL DEFAULT false,
  certifications  text DEFAULT '',
  special_notes   text DEFAULT '',
  -- Pipeline
  status          text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','ai_reviewed','in_progress','awaiting_supplier','quote_ready',
    'awaiting_client','negotiating','closed_won','closed_lost','archived'
  )),
  assigned_to     uuid REFERENCES users(id),
  -- AI
  ai_summary      text DEFAULT '',
  ai_suggestions  jsonb DEFAULT '{}',
  ai_processed_at timestamptz,
  -- Tracking
  priority        int NOT NULL DEFAULT 0,
  deal_value      bigint DEFAULT 0,
  currency        text DEFAULT 'USD',
  closed_at       timestamptz,
  close_reason    text DEFAULT '',
  -- Timestamps
  last_activity_at timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_client ON deals(client_id);
CREATE INDEX idx_deals_assigned ON deals(assigned_to);
CREATE INDEX idx_deals_created ON deals(created_at DESC);
CREATE INDEX idx_deals_urgency ON deals(urgency);

-- 7. DEAL STATUS HISTORY
CREATE TABLE deal_status_history (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id   uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES users(id),
  note       text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsh_deal ON deal_status_history(deal_id);

-- 8. DEAL MESSAGES
CREATE TABLE deal_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  sender_id   uuid REFERENCES users(id),
  sender_role text DEFAULT 'operator',
  body        text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  is_ai_draft boolean NOT NULL DEFAULT false,
  approved    boolean DEFAULT NULL,
  approved_by uuid REFERENCES users(id),
  visible_to  text NOT NULL DEFAULT 'all' CHECK (visible_to IN ('all','internal','client','supplier')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dm_deal ON deal_messages(deal_id, created_at DESC);

-- 9. DEAL NOTES (private operator notes)
CREATE TABLE deal_notes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id   uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id),
  body      text NOT NULL,
  note_type text DEFAULT 'general' CHECK (note_type IN ('general','ai','risk','supplier','compliance')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_deal ON deal_notes(deal_id);

-- 10. DEAL SUPPLIERS (matched suppliers per deal)
CREATE TABLE deal_suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'matched' CHECK (status IN ('matched','contacted','responded','shortlisted','selected','rejected')),
  outreach_at timestamptz,
  response_at timestamptz,
  notes       text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, supplier_id)
);
CREATE INDEX idx_ds_deal ON deal_suppliers(deal_id);

-- 11. RFQS
CREATE TABLE rfqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product     text NOT NULL,
  quantity    text DEFAULT '',
  destination text DEFAULT '',
  packaging   text DEFAULT '',
  certifications text DEFAULT '',
  delivery_timeline text DEFAULT '',
  notes       text DEFAULT '',
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','responded','expired')),
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfqs_deal ON rfqs(deal_id);

-- 12. SUPPLIER RESPONSES
CREATE TABLE supplier_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id      uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price       text DEFAULT '',
  moq         text DEFAULT '',
  lead_time   text DEFAULT '',
  notes       text DEFAULT '',
  valid_until date,
  docs        text[] DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sr_rfq ON supplier_responses(rfq_id);

-- 13. DOCUMENTS
CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid REFERENCES deals(id) ON DELETE CASCADE,
  supplier_id   uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  uploaded_by   uuid NOT NULL REFERENCES users(id),
  file_name     text NOT NULL,
  file_type     text DEFAULT '',
  file_size     int DEFAULT 0,
  storage_path  text NOT NULL,
  doc_type      text DEFAULT 'general',
  visibility    text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client','supplier','all')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_deal ON documents(deal_id);

-- 14. RESPONSE TEMPLATES
CREATE TABLE response_templates (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  body      text NOT NULL,
  category  text DEFAULT 'general',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO response_templates (name, body, category) VALUES
  ('Acknowledgement', 'Thank you for your sourcing request. We have received your requirements and our team is reviewing them. We will get back to you within 24-48 hours with supplier options.', 'intake'),
  ('Need More Info', 'Thank you for your interest. To better serve your request, we need additional information:\n\n- [specific details needed]\n\nPlease reply with these details so we can proceed.', 'clarification'),
  ('Supplier Shortlist', 'Based on your requirements, we have identified the following suppliers:\n\n[supplier list]\n\nWould you like us to proceed with requesting formal quotes?', 'matching'),
  ('Quote Ready', 'We have received quotes from our supplier network for your request. Please find the comparison below:\n\n[quote summary]\n\nLet us know which option you would like to proceed with.', 'quoting'),
  ('Not Available', 'After reviewing your request, we were unable to source the exact product as specified. However, we can suggest the following alternatives:\n\n[alternatives]\n\nWould any of these work for your needs?', 'alternative'),
  ('Compliance Flag', 'Please note: there are compliance considerations for shipping this product to [country]. The following documentation may be required:\n\n[documents]\n\nWe can help coordinate these requirements.', 'compliance');

-- 15. NOTIFICATIONS
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text DEFAULT '',
  body        text NOT NULL,
  deal_id     uuid REFERENCES deals(id) ON DELETE CASCADE,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifs_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifs_unread ON notifications(user_id) WHERE read = false;

-- 16. AUDIT LOG
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id),
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  details     jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Public read for categories and countries
CREATE POLICY cat_read ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY country_read ON countries FOR SELECT TO authenticated USING (true);
CREATE POLICY templates_read ON response_templates FOR SELECT TO authenticated USING (true);

-- Users: own + admin/operator read all
CREATE POLICY users_own ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY users_admin ON users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator')));
CREATE POLICY users_update ON users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Suppliers: admin/operator full, suppliers own
CREATE POLICY suppliers_read ON suppliers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
  OR user_id = auth.uid()
);
CREATE POLICY suppliers_admin ON suppliers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY sp_read ON supplier_products FOR SELECT TO authenticated USING (true);
CREATE POLICY sp_admin ON supplier_products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);

-- Deals: admin/operator see all, client sees own
CREATE POLICY deals_admin ON deals FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY deals_client ON deals FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY deals_insert ON deals FOR INSERT TO authenticated WITH CHECK (true);

-- Deal messages: deal participants
CREATE POLICY dm_admin ON deal_messages FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY dm_client ON deal_messages FOR SELECT TO authenticated USING (
  deal_id IN (SELECT id FROM deals WHERE client_id = auth.uid()) AND visible_to IN ('all','client')
);
CREATE POLICY dm_insert ON deal_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Deal notes: operator/admin only
CREATE POLICY dn_admin ON deal_notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);

-- Deal suppliers, RFQs, responses: admin/operator
CREATE POLICY ds_admin ON deal_suppliers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY rfq_admin ON rfqs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY sr_admin ON supplier_responses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY sr_supplier ON supplier_responses FOR INSERT TO authenticated WITH CHECK (
  supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
);

-- Documents: based on visibility
CREATE POLICY docs_admin ON documents FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','operator'))
);
CREATE POLICY docs_client ON documents FOR SELECT TO authenticated USING (
  deal_id IN (SELECT id FROM deals WHERE client_id = auth.uid()) AND visibility IN ('all','client')
);

-- Notifications: own only
CREATE POLICY notifs_own ON notifications FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Audit: admin only
CREATE POLICY audit_admin ON audit_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY audit_insert ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW deal_pipeline AS
SELECT
  status,
  COUNT(*) AS count,
  SUM(deal_value) AS total_value,
  COUNT(*) FILTER (WHERE urgency = 'urgent') AS urgent_count
FROM deals
WHERE status NOT IN ('archived','closed_lost')
GROUP BY status;

CREATE OR REPLACE VIEW deal_overview AS
SELECT
  d.*,
  u.display_name AS client_display_name,
  c.name AS category_name,
  co.name AS country_name,
  co.region AS country_region,
  a.display_name AS assigned_name,
  (SELECT COUNT(*) FROM deal_messages WHERE deal_id = d.id) AS message_count,
  (SELECT COUNT(*) FROM deal_suppliers WHERE deal_id = d.id) AS supplier_count,
  (SELECT COUNT(*) FROM documents WHERE deal_id = d.id) AS doc_count
FROM deals d
LEFT JOIN users u ON u.id = d.client_id
LEFT JOIN categories c ON c.id = d.category_id
LEFT JOIN countries co ON co.code = d.target_country
LEFT JOIN users a ON a.id = d.assigned_to;
