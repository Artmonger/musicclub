import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () =>
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

const getSupabaseServiceKey = () =>
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client (service role).
 * Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel (or .env.local). Optional fallbacks: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
export function supabaseServer() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();

  // Temporary diagnostic: confirm env presence without logging secrets.
  // Remove or comment out once verified in Vercel logs.
  // eslint-disable-next-line no-console
  console.log('[supabaseServer] env check', {
    hasUrl: Boolean(url),
    hasSecretKey: Boolean(key),
  });

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL and SUPABASE_SECRET_KEY'
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
