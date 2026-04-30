// Product (supplier_products) CRUD for admin listings page
import { supabase } from './supabase.js';

export async function listProducts({ supplierId, featuredOnly = false } = {}) {
  let q = supabase
    .from('supplier_products')
    .select('*, supplier:suppliers(id, company_name, us_state, status)')
    .order('created_at', { ascending: false });
  if (supplierId) q = q.eq('supplier_id', supplierId);
  if (featuredOnly) q = q.eq('featured', true);
  const { data, error } = await q;
  if (error) console.error('[listProducts]', error.message);
  return data || [];
}

export async function addProduct(p) {
  const { data, error } = await supabase
    .from('supplier_products')
    .insert({
      supplier_id: p.supplierId,
      name: p.name,
      description: p.description || '',
      sku: p.sku || '',
      image_url: p.imageUrl || '',
      moq: p.moq || '',
      price_range: p.priceRange || '',
      packaging: p.packaging || '',
      markets: p.markets || [],
      featured: !!p.featured,
      status: p.status || 'active',
    })
    .select()
    .single();
  if (error) console.error('[addProduct]', error.message);
  return { data, error: error?.message };
}

export async function updateProduct(id, updates) {
  const u = {};
  if (updates.name !== undefined) u.name = updates.name;
  if (updates.description !== undefined) u.description = updates.description;
  if (updates.sku !== undefined) u.sku = updates.sku;
  if (updates.imageUrl !== undefined) u.image_url = updates.imageUrl;
  if (updates.moq !== undefined) u.moq = updates.moq;
  if (updates.priceRange !== undefined) u.price_range = updates.priceRange;
  if (updates.packaging !== undefined) u.packaging = updates.packaging;
  if (updates.markets !== undefined) u.markets = updates.markets;
  if (updates.featured !== undefined) u.featured = !!updates.featured;
  if (updates.status !== undefined) u.status = updates.status;
  const { data, error } = await supabase.from('supplier_products').update(u).eq('id', id).select().single();
  if (error) console.error('[updateProduct]', error.message);
  return { data, error: error?.message };
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('supplier_products').delete().eq('id', id);
  if (error) console.error('[deleteProduct]', error.message);
  return { error: error?.message };
}

export async function toggleFeatured(id, featured) {
  return updateProduct(id, { featured });
}

export async function listSuppliersBasic() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, company_name, us_state')
    .eq('status', 'active')
    .order('company_name');
  if (error) console.error('[listSuppliersBasic]', error.message);
  return data || [];
}
