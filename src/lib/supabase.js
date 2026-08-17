import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('your_supabase'));
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export const INTERNAL_EMAIL_DOMAIN = 'stock.local';

export const usernameEmail = (username) =>
  `${String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@${INTERNAL_EMAIL_DOMAIN}`;
