import { createClient } from '@supabase/supabase-js';

/**
 * Single Supabase client for all server routes. Uses ONLY:
 * - process.env.SUPABASE_URL (no NEXT_PUBLIC fallback — avoids split-brain across envs)
 * - process.env.SUPABASE_SECRET_KEY
 */
function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('Missing SUPABASE_URL. Set it in Vercel env (and .env.local for dev). Do not use NEXT_PUBLIC_SUPABASE_URL for server routes.');
  }
  return url.trim();
}

const getSupabaseServiceKey = (): string | undefined =>
  process.env.SUPABASE_SECRET_KEY;

/** Safe hostname only (for logging/headers). Uses only SUPABASE_URL. Returns null if not set. */
export function getSupabaseHost(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function supabaseServer() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('Missing SUPABASE_SECRET_KEY. Set it in Vercel env (and .env.local for dev).');
  }
  const host = getSupabaseHost();
  // eslint-disable-next-line no-console
  console.log('[supabaseServer] using host=%s', host ?? '(unknown)');
  return createClient(url, key.trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * @deprecated Use supabaseServer() instead.
 */
export function createServerSupabase() {
  return supabaseServer();
}

/** Safe Supabase env info for logging/headers only. Uses only SUPABASE_URL (no NEXT_PUBLIC). Never returns secret key value. */
export function getSupabaseSafeInfo(): { host: string | null; hasSecretKey: boolean } {
  return { host: getSupabaseHost(), hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY?.trim()) };
}
