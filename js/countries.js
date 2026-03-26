// BuyDirectFromUSA — Countries Module
import { supabase } from './supabase.js';

let _cache = null;

export async function getAllCountries() {
  if (_cache) return _cache;
  const { data } = await supabase.from('countries').select('*').order('name');
  _cache = data || [];
  return _cache;
}

export async function getCountry(code) {
  const countries = await getAllCountries();
  return countries.find(c => c.code === code);
}

export async function searchCountries(query) {
  const countries = await getAllCountries();
  const q = query.toLowerCase();
  return countries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.region || '').toLowerCase().includes(q));
}

export async function getCountriesByRegion(region) {
  const countries = await getAllCountries();
  return countries.filter(c => c.region === region);
}

export const REGIONS = ['GCC', 'Africa', 'Europe', 'Asia', 'Latin America', 'North America', 'Oceania', 'Middle East'];
