import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () =>
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Server-only Supabase client (service role).
 * Use SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in env.
 */
export function supabaseServer() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * @deprecated Use supabaseServer() instead.
 */
export function createServerSupabase() {
  return supabaseServer();
}
