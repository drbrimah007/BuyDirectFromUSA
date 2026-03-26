// BuyDirectFromUSA — Documents Module
import { supabase } from './supabase.js';

export async function listDocuments(dealId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  if (error) console.error('[listDocuments]', error.message);
  return data || [];
}

export async function uploadDocument(dealId, file, userId, { docType = 'general', visibility = 'internal', supplierId = null } = {}) {
  const ext = file.name.split('.').pop();
  const path = `deals/${dealId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
  if (uploadError) { console.error('[uploadDocument]', uploadError.message); return null; }

  const { data, error } = await supabase.from('documents').insert({
    deal_id: dealId, supplier_id: supplierId,
    uploaded_by: userId, file_name: file.name,
    file_type: file.type, file_size: file.size,
    storage_path: path, doc_type: docType, visibility
  }).select().single();
  if (error) console.error('[uploadDocument meta]', error.message);
  return data;
}

export async function getDocumentUrl(path) {
  const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
  return data?.signedUrl || '';
}

export async function deleteDocument(id, path) {
  await supabase.storage.from('documents').remove([path]);
  await supabase.from('documents').delete().eq('id', id);
}

export const DOC_TYPES = {
  general: 'General', spec: 'Product Spec', invoice: 'Invoice',
  quote: 'Quotation', certificate: 'Certificate', halal: 'Halal Doc',
  compliance: 'Compliance', labeling: 'Labeling', shipping: 'Shipping',
  brochure: 'Brochure', contract: 'Contract', other: 'Other'
};
