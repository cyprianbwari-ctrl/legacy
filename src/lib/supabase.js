import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(
  url &&
  anonKey &&
  !String(url).includes('your_supabase')
);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const INTERNAL_EMAIL_DOMAIN = 'stock.local';

export function usernameEmail(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('@')) return raw;
  const safe = raw.replace(/[^a-z0-9._-]/g, '');
  return `${safe}@${INTERNAL_EMAIL_DOMAIN}`;
}
