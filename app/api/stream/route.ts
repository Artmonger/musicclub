import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BUCKET = 'music-files';

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

/** Content-Type from file extension in path (for iOS Safari). */
function contentTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'm4a') return 'audio/mp4';
  return 'application/octet-stream';
}

function safeFilename(name: string): string {
  const base = name.replace(/[^\w.\-]/g, '_').slice(0, 200) || 'audio';
  return base.endsWith('.mp3') || base.endsWith('.wav') || base.endsWith('.m4a') ? base : `${base}.mp3`;
}

const CACHE_NO_STORE = 'no-store, no-cache, max-age=0, must-revalidate';
const CORS_ORIGIN = '*';

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
        { status: 400, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
      );
    }

    const contentType = contentTypeFromPath(path);

    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('Stream (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.' },
        { status: 503, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
      );
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
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'Not found' },
          { status: 404, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
        );
      }
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch file for download' }, { status: 502 });
      }
      const suggestedName = searchParams.get('filename')?.trim();
      const filename = safeFilename(suggestedName || path.split('/').pop() || 'audio');
      return new NextResponse(res.body, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': contentType,
          'Cache-Control': CACHE_NO_STORE,
          'Access-Control-Allow-Origin': CORS_ORIGIN,
        },
      });
    }

    // Stream with full Range support for iOS Safari
    const rangeHeader = request.headers.get('range') ?? '';
    const hasRange = /^bytes=/.test(rangeHeader);
    const fetchHeaders: HeadersInit = {};
    if (hasRange) fetchHeaders['Range'] = rangeHeader;

    const upstream = await fetch(signedUrl, { headers: fetchHeaders });

    if (upstream.status === 404) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
      );
    }

    if (upstream.status === 416) {
      const upstreamRange = upstream.headers.get('content-range');
      const headers: Record<string, string> = {
        'Accept-Ranges': 'bytes',
        'Content-Range': upstreamRange ?? `bytes */0`,
        'Content-Type': contentType,
        'Cache-Control': CACHE_NO_STORE,
        'Access-Control-Allow-Origin': CORS_ORIGIN,
      };
      return new NextResponse(null, { status: 416, headers });
    }

    if (!upstream.ok && upstream.status !== 206) {
      console.error('[stream] upstream error path=%s status=%s', path, upstream.status);
      return NextResponse.json(
        { error: 'Failed to stream file' },
        { status: 502, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
      );
    }

    const contentRange = upstream.headers.get('content-range');
    const contentLength = upstream.headers.get('content-length');
    const status = upstream.status;
    console.log('[stream] path=%s hasRange=%s status=%s contentRange=%s contentLength=%s',
      path, hasRange, status, contentRange ?? '(none)', contentLength ?? '(none)');

    const headers: Record<string, string> = {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': CACHE_NO_STORE,
      'Access-Control-Allow-Origin': CORS_ORIGIN,
    };
    if (contentRange) headers['Content-Range'] = contentRange;
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(upstream.body, { status, headers });
  } catch (err) {
    console.error('Stream signed URL:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500, headers: { 'Cache-Control': CACHE_NO_STORE, 'Access-Control-Allow-Origin': CORS_ORIGIN } }
    );
  }
}
