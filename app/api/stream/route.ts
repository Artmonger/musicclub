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
    console.log('[stream] path=%s signedHost=%s download=%s', path, signedHost, isDownload);

    if (isDownload) {
      const res = await fetch(signedUrl);
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch file for download' }, { status: 502 });
      }
      const suggestedName = searchParams.get('filename')?.trim();
      const filename = safeFilename(suggestedName || path.split('/').pop() || 'audio');
      return new NextResponse(res.body, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        },
      });
    }

    // Stream with Range support for mobile Safari (206 Partial Content)
    const rangeHeader = request.headers.get('range') ?? '';
    const hasRange = /^bytes=/.test(rangeHeader);
    const fetchHeaders: HeadersInit = {};
    if (hasRange) fetchHeaders['Range'] = rangeHeader;

    const upstream = await fetch(signedUrl, { headers: fetchHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      console.error('[stream] upstream error path=%s status=%s', path, upstream.status);
      return NextResponse.json({ error: 'Failed to stream file' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentRange = upstream.headers.get('content-range');
    const contentLength = upstream.headers.get('content-length');
    const status = upstream.status;
    console.log('[stream] path=%s hasRange=%s upstreamStatus=%s contentRange=%s contentLength=%s contentType=%s',
      path, hasRange, status, contentRange ?? '(none)', contentLength ?? '(none)', contentType);

    const headers: Record<string, string> = {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
    };
    if (contentRange) headers['Content-Range'] = contentRange;
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(upstream.body, { status, headers });
  } catch (err) {
    console.error('Stream signed URL:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500 }
    );
  }
}
