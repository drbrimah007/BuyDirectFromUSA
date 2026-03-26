// BuyDirectFromUSA — Suppliers Module
import { supabase } from './supabase.js';

export async function listSuppliers({ verified, category, status = 'active' } = {}) {
  let query = supabase.from('suppliers').select('*').eq('status', status).order('preferred', { ascending: false });
  if (verified !== undefined) query = query.eq('verified', verified);
  const { data, error } = await query;
  if (error) console.error('[listSuppliers]', error.message);
  return data || [];
}

export async function getSupplier(id) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*, products:supplier_products(*)')
    .eq('id', id).single();
  if (error) console.error('[getSupplier]', error.message);
  return data;
}

export async function createSupplier({ companyName, contactName, email, phone, website, country = 'US', usState, categories = [], marketsServed = [], certifications = [], moqRange, privateLabel = false, notes }) {
  const { data, error } = await supabase.from('suppliers').insert({
    company_name: companyName, contact_name: contactName || '', email: email || '',
    phone: phone || '', website: website || '', country, us_state: usState || '',
    categories, markets_served: marketsServed, certifications, moq_range: moqRange || '',
    private_label: privateLabel, notes: notes || ''
  }).select().single();
  if (error) console.error('[createSupplier]', error.message);
  return data;
}

export async function updateSupplier(id, updates) {
  const { data, error } = await supabase.from('suppliers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) console.error('[updateSupplier]', error.message);
  return data;
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  return !error;
}

export async function autoMatchSuppliers(categoryId, targetCountry) {
  let query = supabase.from('suppliers').select('*').eq('status', 'active').eq('export_ready', true);
  if (categoryId) query = query.contains('categories', [categoryId]);
  if (targetCountry) query = query.contains('markets_served', [targetCountry]);
  const { data } = await query;
  return data || [];
}
