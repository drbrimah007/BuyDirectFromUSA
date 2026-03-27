// BuyDirectFromUSA — Client Request Module
import { supabase } from './supabase.js';

// Submit a sourcing request (creates a deal)
export async function submitRequest({
  clientId = null, clientName, clientEmail, clientCompany = '', clientCountry = '',
  requestType = 'product_sourcing', productNeeded, categorySlug = '',
  targetCountry = '', targetRegion = '', quantity = '', packaging = '',
  urgency = 'normal', budgetRange = '', privateLabel = false,
  certifications = '', specialNotes = '', dynamicData = {}
}) {
  // Append dynamic form fields to special notes if present
  const dynamicEntries = Object.entries(dynamicData).filter(([,v]) => v);
  if (dynamicEntries.length > 0) {
    const dynamicText = dynamicEntries.map(([k,v]) => `${k}: ${v}`).join('\n');
    specialNotes = specialNotes ? specialNotes + '\n\n--- Additional Details ---\n' + dynamicText : dynamicText;
  }
  // Resolve category ID from slug
  let categoryId = null;
  if (categorySlug) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).single();
    if (cat) categoryId = cat.id;
  }

  // Anonymous submitters have no SELECT policy on deals, so .select().single()
  // after insert triggers a second RLS check that fails for the anon role.
  // Authenticated users (logged-in clients) can safely return the row.
  const isAuthenticated = !!clientId;

  let query = supabase.from('deals').insert({
    client_id: clientId,
    client_name: clientName, client_email: clientEmail,
    client_company: clientCompany, client_country: clientCountry,
    request_type: requestType, product_needed: productNeeded,
    category_id: categoryId, target_country: targetCountry,
    target_region: targetRegion, quantity, packaging,
    urgency, budget_range: budgetRange, private_label: privateLabel,
    certifications, special_notes: specialNotes,
    status: 'new'
  });

  // Only request the row back when the caller is authenticated —
  // anon has INSERT-only access and no SELECT policy on deals.
  if (isAuthenticated) query = query.select().single();

  const { data, error } = await query;

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
