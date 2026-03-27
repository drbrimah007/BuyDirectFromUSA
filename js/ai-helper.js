// BuyDirectFromUSA — AI Helper Module
// Generates draft responses, summaries, and suggestions for deals
// Currently uses templates — can be wired to Claude API later

import { supabase } from './supabase.js';

export function generateRequestSummary(deal) {
  const parts = [];
  parts.push(`Client ${deal.client_name || 'Unknown'} is looking for ${deal.product_needed || 'unspecified product'}.`);
  if (deal.target_country) parts.push(`Target market: ${deal.country_name || deal.target_country}.`);
  if (deal.quantity) parts.push(`Quantity: ${deal.quantity}.`);
  if (deal.packaging) parts.push(`Packaging: ${deal.packaging}.`);
  if (deal.private_label) parts.push('Private label requested.');
  if (deal.certifications) parts.push(`Certifications needed: ${deal.certifications}.`);
  if (deal.budget_range) parts.push(`Budget: ${deal.budget_range}.`);
  if (deal.urgency === 'urgent') parts.push('URGENT request.');
  return parts.join(' ');
}

export function generateDraftResponse(deal, type = 'acknowledgement') {
  const name = deal.client_name?.split(' ')[0] || 'there';
  const product = deal.product_needed || 'your requested product';

  const templates = {
    acknowledgement: `Hi ${name},\n\nThank you for your sourcing request for ${product}. We have received your requirements and our team is reviewing them.\n\nWe will get back to you within 24-48 hours with supplier options and pricing information.\n\nBest regards,\nBuyDirectFromUSA Sourcing Team`,

    need_info: `Hi ${name},\n\nThank you for your interest in sourcing ${product}. To better match you with the right suppliers, we need a few more details:\n\n- [Specific quantity/volume]\n- [Preferred packaging format]\n- [Any certification requirements]\n- [Target delivery timeline]\n\nPlease reply with these details so we can proceed.\n\nBest regards,\nBuyDirectFromUSA`,

    supplier_shortlist: `Hi ${name},\n\nBased on your requirements for ${product}, we have identified several potential U.S. suppliers:\n\n[Supplier 1] — [Brief description]\n[Supplier 2] — [Brief description]\n[Supplier 3] — [Brief description]\n\nWould you like us to proceed with requesting formal quotes from any of these suppliers?\n\nBest regards,\nBuyDirectFromUSA`,

    quote_ready: `Hi ${name},\n\nGreat news — we have received quotes from our supplier network for ${product}:\n\n[Quote comparison summary]\n\nPlease review and let us know which option you would like to proceed with. We can also negotiate further on your behalf.\n\nBest regards,\nBuyDirectFromUSA`,

    not_available: `Hi ${name},\n\nAfter reviewing your request for ${product}, we were unable to find an exact match from our current supplier network. However, we can suggest the following alternatives:\n\n[Alternative 1]\n[Alternative 2]\n\nWould any of these work for your needs? We can also expand our search.\n\nBest regards,\nBuyDirectFromUSA`,

    compliance_alert: `Hi ${name},\n\nPlease note: there are compliance considerations for shipping ${product} to ${deal.country_name || deal.target_country || 'your target market'}.\n\nThe following documentation may be required:\n- [Document 1]\n- [Document 2]\n\nWe can help coordinate these requirements as part of your sourcing.\n\nBest regards,\nBuyDirectFromUSA`
  };

  return templates[type] || templates.acknowledgement;
}

export function suggestNextActions(deal) {
  const actions = [];
  if (deal.status === 'new') {
    actions.push({ label: 'Review request details', priority: 'high' });
    actions.push({ label: 'Generate AI summary', priority: 'medium' });
    actions.push({ label: 'Match suppliers', priority: 'medium' });
  }
  if (deal.status === 'ai_reviewed') {
    actions.push({ label: 'Send acknowledgement to client', priority: 'high' });
    actions.push({ label: 'Contact matched suppliers', priority: 'high' });
  }
  if (deal.status === 'awaiting_supplier') {
    actions.push({ label: 'Follow up with suppliers', priority: 'medium' });
    actions.push({ label: 'Check for responses', priority: 'medium' });
  }
  if (deal.status === 'quote_ready') {
    actions.push({ label: 'Send quote summary to client', priority: 'high' });
    actions.push({ label: 'Prepare comparison document', priority: 'medium' });
  }
  if (deal.supplier_count === 0) {
    actions.push({ label: 'Match suppliers to this request', priority: 'high' });
  }
  if (!deal.ai_summary) {
    actions.push({ label: 'Generate AI summary', priority: 'medium' });
  }
  return actions;
}

// Save AI summary to deal
export async function saveAiSummary(dealId, summary) {
  await supabase.from('deals').update({
    ai_summary: summary, ai_processed_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq('id', dealId);
}
