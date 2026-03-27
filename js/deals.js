// BuyDirectFromUSA — Deals Module
import { supabase } from './supabase.js';

// ── Pipeline counts ───────────────────────────────────────────────
export async function getPipelineCounts() {
  const { data, error } = await supabase.from('deal_pipeline').select('*');
  if (error) console.error('[getPipelineCounts]', error.message);
  const counts = {};
  (data || []).forEach(r => { counts[r.status] = { count: r.count, total_value: r.total_value, urgent: r.urgent_count }; });
  return counts;
}

// ── List deals ────────────────────────────────────────────────────
export async function listDeals({ status, assignedTo, urgency, limit = 50, offset = 0 } = {}) {
  let query = supabase
    .from('deal_overview')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);
  if (urgency) query = query.eq('urgency', urgency);
  const { data, error } = await query;
  if (error) console.error('[listDeals]', error.message);
  return data || [];
}

// ── Get single deal ───────────────────────────────────────────────
export async function getDeal(id) {
  const { data, error } = await supabase
    .from('deal_overview')
    .select('*')
    .eq('id', id)
    .single();
  if (error) console.error('[getDeal]', error.message);
  return data;
}

// ── Create deal (from client request) ─────────────────────────────
export async function createDeal({
  clientId, clientName, clientEmail, clientCompany, clientCountry,
  requestType, productNeeded, categoryId, targetCountry, targetRegion,
  quantity, packaging, urgency = 'normal', budgetRange, privateLabel = false,
  certifications, specialNotes
}) {
  const { data, error } = await supabase
    .from('deals')
    .insert({
      client_id: clientId || null,
      client_name: clientName, client_email: clientEmail,
      client_company: clientCompany || '', client_country: clientCountry || '',
      request_type: requestType, product_needed: productNeeded,
      category_id: categoryId || null, target_country: targetCountry || '',
      target_region: targetRegion || '', quantity: quantity || '',
      packaging: packaging || '', urgency,
      budget_range: budgetRange || '', private_label: privateLabel,
      certifications: certifications || '', special_notes: specialNotes || '',
      status: 'new'
    })
    .select()
    .single();
  if (error) console.error('[createDeal]', error.message);
  return data;
}

// ── Update deal ───────────────────────────────────────────────────
export async function updateDeal(id, updates) {
  const { data, error } = await supabase
    .from('deals')
    .update({ ...updates, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) console.error('[updateDeal]', error.message);
  return data;
}

// ── Change deal status ────────────────────────────────────────────
export async function changeDealStatus(id, newStatus, userId, note = '') {
  const deal = await getDeal(id);
  const oldStatus = deal?.status;
  await updateDeal(id, { status: newStatus });
  // Log history
  await supabase.from('deal_status_history').insert({
    deal_id: id, old_status: oldStatus, new_status: newStatus,
    changed_by: userId, note
  });
  return true;
}

// ── Assign deal ───────────────────────────────────────────────────
export async function assignDeal(id, operatorId) {
  return updateDeal(id, { assigned_to: operatorId });
}

// ── Deal messages ─────────────────────────────────────────────────
export async function getDealMessages(dealId, { internalOnly = false } = {}) {
  let query = supabase
    .from('deal_messages')
    .select('*, sender:users(display_name, role)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });
  if (internalOnly) query = query.eq('is_internal', true);
  const { data, error } = await query;
  if (error) console.error('[getDealMessages]', error.message);
  return data || [];
}

export async function sendDealMessage(dealId, senderId, { body, isInternal = false, isAiDraft = false, visibleTo = 'all' }) {
  const { data, error } = await supabase
    .from('deal_messages')
    .insert({
      deal_id: dealId, sender_id: senderId, body,
      is_internal: isInternal, is_ai_draft: isAiDraft,
      sender_role: 'operator', visible_to: visibleTo
    })
    .select()
    .single();
  if (error) console.error('[sendDealMessage]', error.message);
  return data;
}

export async function approveAiDraft(messageId, userId) {
  const { error } = await supabase.from('deal_messages')
    .update({ approved: true, approved_by: userId, is_ai_draft: false })
    .eq('id', messageId);
  return !error;
}

// ── Deal notes ────────────────────────────────────────────────────
export async function getDealNotes(dealId) {
  const { data, error } = await supabase
    .from('deal_notes')
    .select('*, user:users(display_name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  if (error) console.error('[getDealNotes]', error.message);
  return data || [];
}

export async function addDealNote(dealId, userId, body, noteType = 'general') {
  const { data, error } = await supabase
    .from('deal_notes')
    .insert({ deal_id: dealId, user_id: userId, body, note_type: noteType })
    .select()
    .single();
  if (error) console.error('[addDealNote]', error.message);
  return data;
}

// ── Deal suppliers ────────────────────────────────────────────────
export async function getDealSuppliers(dealId) {
  const { data, error } = await supabase
    .from('deal_suppliers')
    .select('*, supplier:suppliers(company_name, contact_name, email, verified, preferred)')
    .eq('deal_id', dealId);
  if (error) console.error('[getDealSuppliers]', error.message);
  return data || [];
}

export async function matchSupplier(dealId, supplierId) {
  const { data, error } = await supabase
    .from('deal_suppliers')
    .insert({ deal_id: dealId, supplier_id: supplierId })
    .select()
    .single();
  if (error) console.error('[matchSupplier]', error.message);
  return data;
}

export async function updateDealSupplier(id, updates) {
  const { error } = await supabase.from('deal_suppliers').update(updates).eq('id', id);
  return !error;
}

// ── Status labels ─────────────────────────────────────────────────
export const DEAL_STATUSES = {
  new: 'New Request',
  ai_reviewed: 'AI Reviewed',
  in_progress: 'In Progress',
  awaiting_supplier: 'Awaiting Supplier',
  quote_ready: 'Quote Ready',
  awaiting_client: 'Awaiting Client',
  negotiating: 'Negotiating',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
  archived: 'Archived'
};

export const URGENCY_COLORS = {
  low: '#64748b', normal: '#3b82f6', high: '#f59e0b', urgent: '#dc2626'
};

export const STATUS_COLORS = {
  new: '#6366f1', ai_reviewed: '#8b5cf6', in_progress: '#3b82f6',
  awaiting_supplier: '#f59e0b', quote_ready: '#10b981', awaiting_client: '#06b6d4',
  negotiating: '#f97316', closed_won: '#16a34a', closed_lost: '#ef4444', archived: '#94a3b8'
};
