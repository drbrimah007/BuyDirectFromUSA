// BuyDirectFromUSA — Client Request Module
import { supabase } from './supabase.js';

// Submit a sourcing request (creates a deal)
export async function submitRequest({
  clientId = null, clientName, clientEmail, clientCompany = '', clientCountry = '',
  requestType = 'product_sourcing', productNeeded, categorySlug = '',
  targetCountry = '', targetRegion = '', quantity = '', packaging = '',
  urgency = 'normal', budgetRange = '', privateLabel = false,
  certifications = '', specialNotes = ''
}) {
  // Resolve category ID from slug
  let categoryId = null;
  if (categorySlug) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).single();
    if (cat) categoryId = cat.id;
  }

  const { data, error } = await supabase.from('deals').insert({
    client_id: clientId,
    client_name: clientName, client_email: clientEmail,
    client_company: clientCompany, client_country: clientCountry,
    request_type: requestType, product_needed: productNeeded,
    category_id: categoryId, target_country: targetCountry,
    target_region: targetRegion, quantity, packaging,
    urgency, budget_range: budgetRange, private_label: privateLabel,
    certifications, special_notes: specialNotes,
    status: 'new'
  }).select().single();

  if (error) console.error('[submitRequest]', error.message);
  return { data, error: error?.message };
}

// List my requests (client view)
export async function myRequests(clientId) {
  const { data, error } = await supabase
    .from('deals')
    .select('*, category:categories(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) console.error('[myRequests]', error.message);
  return data || [];
}

// Get categories for form
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');
  if (error) console.error('[getCategories]', error.message);
  return data || [];
}

// Get countries for form
export async function getCountries() {
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .order('name');
  if (error) console.error('[getCountries]', error.message);
  return data || [];
}
