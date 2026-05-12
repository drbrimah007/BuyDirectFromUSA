// BuyDirectFromUSA — Client Request Module
import { supabase } from './supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Submit a sourcing request (creates a deal).
// Anonymous submissions route through the protected edge function
// (honeypot + time-gate + disposable-email block + per-IP rate-limit + optional Turnstile).
// Authenticated submissions still use direct insert so we can return the row.
export async function submitRequest({
  clientId = null, clientName, clientEmail, clientCompany = '', clientCountry = '',
  requestType = 'product_sourcing', productNeeded, categorySlug = '',
  targetCountry = '', targetRegion = '', quantity = '', packaging = '',
  urgency = 'normal', budgetRange = '', privateLabel = false,
  certifications = '', specialNotes = '', dynamicData = {},
  // Bot-control payload — set by chatbot / form before submitting
  _meta = {}
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

  const payload = {
    client_id: clientId,
    client_name: clientName, client_email: clientEmail,
    client_company: clientCompany, client_country: clientCountry,
    request_type: requestType, product_needed: productNeeded,
    category_id: categoryId, target_country: targetCountry,
    target_region: targetRegion, quantity, packaging,
    urgency, budget_range: budgetRange, private_label: privateLabel,
    certifications, special_notes: specialNotes,
  };

  // Authenticated: direct insert (returns row via RLS SELECT policy)
  if (clientId) {
    const { data, error } = await supabase.from('deals').insert({ ...payload, status: 'new' }).select().single();
    if (error) console.error('[submitRequest]', error.message);
    return { data, error: error?.message };
  }

  // Anonymous: route through the protected edge function (no Supabase JS client —
  // we need full control over headers + body for the bot-control _meta payload).
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-deal-protected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ ...payload, _meta }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[submitRequest] protected reject:', out);
      return { data: null, error: out.code || out.error || `http ${res.status}` };
    }
    return { data: { id: out.deal_id }, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[submitRequest] network error:', msg);
    return { data: null, error: msg };
  }
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
