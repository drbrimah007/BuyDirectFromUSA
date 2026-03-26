// BuyDirectFromUSA — RFQ Workflow Module
import { supabase } from './supabase.js';

export async function createRFQ(dealId, supplierId, { product, quantity, destination, packaging, certifications, deliveryTimeline, notes }) {
  const { data, error } = await supabase.from('rfqs').insert({
    deal_id: dealId, supplier_id: supplierId, product, quantity: quantity || '',
    destination: destination || '', packaging: packaging || '',
    certifications: certifications || '', delivery_timeline: deliveryTimeline || '',
    notes: notes || '', status: 'draft'
  }).select().single();
  if (error) console.error('[createRFQ]', error.message);
  return data;
}

export async function listRFQs(dealId) {
  const { data } = await supabase.from('rfqs')
    .select('*, supplier:suppliers(company_name, contact_name, email)')
    .eq('deal_id', dealId).order('created_at', { ascending: false });
  return data || [];
}

export async function sendRFQ(rfqId) {
  await supabase.from('rfqs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', rfqId);
}

export async function submitResponse(rfqId, supplierId, { price, moq, leadTime, notes, validUntil }) {
  const { data } = await supabase.from('supplier_responses').insert({
    rfq_id: rfqId, supplier_id: supplierId, price: price || '', moq: moq || '',
    lead_time: leadTime || '', notes: notes || '', valid_until: validUntil || null
  }).select().single();
  await supabase.from('rfqs').update({ status: 'responded' }).eq('id', rfqId);
  return data;
}

export async function listResponses(rfqId) {
  const { data } = await supabase.from('supplier_responses')
    .select('*, supplier:suppliers(company_name)')
    .eq('rfq_id', rfqId).order('created_at');
  return data || [];
}

export async function compareResponses(dealId) {
  const rfqs = await listRFQs(dealId);
  const comparisons = [];
  for (const rfq of rfqs) {
    const responses = await listResponses(rfq.id);
    responses.forEach(r => {
      comparisons.push({
        supplier: rfq.supplier?.company_name || '—',
        product: rfq.product,
        price: r.price, moq: r.moq, leadTime: r.lead_time,
        notes: r.notes, validUntil: r.valid_until
      });
    });
  }
  return comparisons;
}
