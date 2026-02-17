import { createClient } from '@supabase/supabase-js';

/**
 * Single Supabase client for all server routes. Uses only:
 * - process.env.SUPABASE_URL (fallback: NEXT_PUBLIC_SUPABASE_URL)
 * - process.env.SUPABASE_SECRET_KEY
 * No SUPABASE_SERVICE_ROLE_KEY or anon keys — ensure reads/writes hit the same project.
 */
const getSupabaseUrl = () =>
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

const getSupabaseServiceKey = () =>
  process.env.SUPABASE_SECRET_KEY;
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

/** Safe Supabase env info for logging/headers only. Never returns secret key value. */
export function getSupabaseSafeInfo(): { host: string | null; hasSecretKey: boolean } {
  let host: string | null = null;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {
      host = null;
    }
  }
  return { host, hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY) };
}
