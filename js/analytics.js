// BuyDirectFromUSA — Analytics Module
import { supabase } from './supabase.js';

export async function getDashboardStats() {
  const [deals, suppliers, newDeals, wonDeals] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true }),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('deals').select('id,deal_value', { count: 'exact' }).eq('status', 'closed_won')
  ]);

  const totalValue = (wonDeals.data || []).reduce((s, d) => s + (d.deal_value || 0), 0);

  return {
    totalDeals: deals.count || 0,
    totalSuppliers: suppliers.count || 0,
    newRequests: newDeals.count || 0,
    closedWon: wonDeals.count || 0,
    totalRevenue: totalValue
  };
}

export async function getDealsByStatus() {
  const { data } = await supabase.from('deal_pipeline').select('*');
  return data || [];
}

export async function getRecentDeals(limit = 5) {
  const { data } = await supabase
    .from('deal_overview')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getDealsByCountry() {
  const { data } = await supabase
    .from('deals')
    .select('target_country')
    .neq('target_country', '');
  const counts = {};
  (data || []).forEach(d => {
    const c = d.target_country || 'Unknown';
    counts[c] = (counts[c] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export async function getDealsByCategory() {
  const { data } = await supabase
    .from('deal_overview')
    .select('category_name')
    .not('category_name', 'is', null);
  const counts = {};
  (data || []).forEach(d => {
    const c = d.category_name || 'Other';
    counts[c] = (counts[c] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
