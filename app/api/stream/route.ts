import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'music-files';
const CACHE_NO_STORE = 'no-store, no-cache, max-age=0, must-revalidate';

function normalizeStreamPath(raw: string): string | null {
  let path = raw.trim();
  path = path.replace(/^\/+/, '');
  if (!path || path === 'undefined') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const match = url.pathname.match(new RegExp(`/${BUCKET}/(.+)`));
      if (match?.[1]) {
        try {
          path = decodeURIComponent(match[1]);
        } catch {
          path = match[1];
        }
      }
      if (path.startsWith('http')) return null;
    } catch {
      return null;
    }
  }
  if (path.includes('/storage/v1/')) {
    const match = path.match(new RegExp(`/${BUCKET}/([^?]+)`));
    if (match?.[1]) {
      try {
        path = decodeURIComponent(match[1]);
      } catch {
        path = match[1];
      }
    }
    if (path.includes('/storage/v1/')) return null;
  }
  path = path.replace(new RegExp(`^${BUCKET}/?`), '').trim();
  path = path.replace(/^\/+/, '');
  if (!path || !path.includes('/')) return null;
  return path;
}

function safeFilename(name: string): string {
  const base = name.replace(/[^\w.\-]/g, '_').slice(0, 200) || 'audio';
  return base.endsWith('.mp3') || base.endsWith('.wav') || base.endsWith('.m4a') ? base : `${base}.mp3`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path')?.trim() ?? '';
    const path = normalizeStreamPath(rawPath);
    const expiresIn = 3600;
    const isDownload = searchParams.get('download') === '1' || searchParams.get('download') === 'true';

    if (!path) {
      return NextResponse.json(
        {
          error: rawPath
            ? 'path must be object path only (e.g. projectId/filename.ext). Do not send full URL or music-files/ prefix.'
            : 'path query parameter is required',
        },
        { status: 400, headers: { 'Cache-Control': CACHE_NO_STORE } }
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
        { status: 503, headers: { 'Cache-Control': CACHE_NO_STORE } }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Stream createSignedUrl:', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to create signed URL' },
        { status: 500, headers: { 'Cache-Control': CACHE_NO_STORE } }
      );
    }
    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: 'Could not create signed URL' },
        { status: 500, headers: { 'Cache-Control': CACHE_NO_STORE } }
      );
    }

    const signedUrl = data.signedUrl;
    let signedHost = '';
    try {
      signedHost = new URL(signedUrl).hostname;
    } catch {
      signedHost = '(parse failed)';
    }

    if (isDownload) {
      const upstream = await fetch(signedUrl);
      if (!upstream.ok) {
        console.log('[stream] mode=download path=%s status=%s signedHost=%s', path, upstream.status, signedHost);
        return NextResponse.json(
          { error: 'Failed to fetch file for download' },
          { status: 502, headers: { 'Cache-Control': CACHE_NO_STORE } }
        );
      }
      const suggestedName = searchParams.get('filename')?.trim();
      const filename = safeFilename(suggestedName || path.split('/').pop() || 'audio');
      // Do not set Content-Length or content-encoding (streaming can mismatch length → corrupt downloads).
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const headers: Record<string, string> = {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
        'Cache-Control': CACHE_NO_STORE,
        'X-Stream-Mode': 'download-proxy',
      };
      console.log('[stream] path=%s mode=download headStatus=%s headType=%s', path, upstream.status, contentType);
      return new NextResponse(upstream.body, { status: upstream.status, headers });
    }

    // Playback: HEAD for diagnostics; then redirect. Do not change behavior on 404.
    const head = await fetch(signedUrl, { method: 'HEAD' }).catch(() => null);
    const headStatus = head?.status != null ? String(head.status) : 'error';
    const headType = head?.headers.get('content-type') ?? 'none';
    console.log('[stream] path=%s mode=redirect headStatus=%s headType=%s', path, headStatus, headType);
    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': CACHE_NO_STORE,
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Stream-Mode': 'redirect',
        'X-Stream-Head-Status': headStatus,
        'X-Stream-Head-Type': headType,
      },
    });
  } catch (err) {
    console.error('Stream:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500, headers: { 'Cache-Control': CACHE_NO_STORE } }
    );
  }
}
