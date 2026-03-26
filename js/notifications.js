// BuyDirectFromUSA — Notifications Module
import { supabase } from './supabase.js';

export async function listNotifications(userId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[listNotifications]', error.message);
  return data || [];
}

export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count || 0;
}

export async function markRead(id) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllRead(userId) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

export async function createNotification(userId, { type, title = '', body, dealId = null }) {
  const { data } = await supabase.from('notifications').insert({
    user_id: userId, type, title, body, deal_id: dealId
  }).select().single();
  return data;
}

// Notify all operators about a new deal
export async function notifyOperatorsNewDeal(deal) {
  const { data: operators } = await supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'operator']);
  if (!operators?.length) return;
  for (const op of operators) {
    await createNotification(op.id, {
      type: 'new_deal',
      title: 'New Sourcing Request',
      body: `${deal.client_name} needs: ${deal.product_needed} for ${deal.target_country || 'unspecified market'}`,
      dealId: deal.id
    });
  }
}
