import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BUCKET = 'music-files';

/**
 * Normalize storage path to object path only: projectId/filename (no full URL, no bucket prefix).
 * Returns null if path cannot be normalized.
 */
function normalizeStreamPath(raw: string): string | null {
  let path = raw.trim();
  if (!path || path === 'undefined') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const match = url.pathname.match(new RegExp(`/${BUCKET}/(.+)`));
      path = match ? match[1] : path;
      if (path.startsWith('http')) return null;
    } catch {
      return null;
    }
  }
  if (path.includes('/storage/v1/')) {
    const match = path.match(new RegExp(`/${BUCKET}/([^?]+)`));
    path = match ? match[1] : path;
    if (path.includes('/storage/v1/')) return null;
  }
  path = path.replace(new RegExp(`^${BUCKET}/?`), '').trim();
  if (!path || !path.includes('/')) return null;
  return path;
}

/**
 * Stream: redirect to a short-lived signed URL. Browser should ONLY request /api/stream?path=<storagePath>.
 * path must be object path only: projectId/filename (never full URL, never music-files/ prefix).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path')?.trim() ?? '';
    const path = normalizeStreamPath(rawPath);
    const expiresIn = 3600;

    if (!path) {
      return NextResponse.json(
        {
          error: rawPath
            ? 'path must be object path only (e.g. projectId/filename.ext). Do not send full URL or music-files/ prefix.'
            : 'path query parameter is required',
        },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('Stream (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    if (!data?.signedUrl) {
      return NextResponse.json({ error: 'Could not create signed URL' }, { status: 404 });
    }

    const signedUrl = data.signedUrl;
    let signedHost = '';
    try {
      signedHost = new URL(signedUrl).hostname;
    } catch {
      signedHost = '(parse failed)';
    }
    console.log('[stream] path=%s signedHost=%s', path, signedHost);

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' },
    });
  } catch (err) {
    console.error('Stream signed URL:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500 }
    );
  }
}
