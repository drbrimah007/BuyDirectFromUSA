// BuyDirectFromUSA — Response Templates Module
import { supabase } from './supabase.js';

export async function listTemplates() {
  const { data, error } = await supabase
    .from('response_templates')
    .select('*')
    .order('category', { ascending: true });
  if (error) console.error('[listTemplates]', error.message);
  return data || [];
}

export async function getTemplate(id) {
  const { data } = await supabase.from('response_templates').select('*').eq('id', id).single();
  return data;
}

export async function createTemplate(userId, { name, body, category = 'general' }) {
  const { data, error } = await supabase.from('response_templates').insert({
    name, body, category, created_by: userId
  }).select().single();
  if (error) console.error('[createTemplate]', error.message);
  return data;
}

export async function updateTemplate(id, { name, body, category }) {
  const { data, error } = await supabase.from('response_templates')
    .update({ name, body, category })
    .eq('id', id).select().single();
  if (error) console.error('[updateTemplate]', error.message);
  return data;
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('response_templates').delete().eq('id', id);
  return !error;
}
