// BuyDirectFromUSA — Auth Module
import { supabase } from './supabase.js';

export async function signUp({ email, password, displayName, companyName, country }) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: displayName } }
  });
  if (error) return { error: error.message };
  if (data.user) {
    await supabase.from('users').update({
      display_name: displayName || '', company_name: companyName || '', country: country || ''
    }).eq('id', data.user.id);
  }
  return { user: data.user };
}

export async function logIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { user: data.user };
}

export async function logOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(userId) {
  const { data } = await supabase.from('users').select('*').eq('id', userId).single();
  return data;
}
