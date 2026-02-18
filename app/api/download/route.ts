import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BUCKET = 'music-files';

function normalizePath(raw: string): string | null {
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

/** Filename = last segment of path; safe for Content-Disposition. */
function filenameFromPath(path: string): string {
  const segment = path.split('/').pop() ?? 'audio';
  return segment.replace(/[^\w.\-]/g, '_').slice(0, 200) || 'audio';
}

function contentTypeFromExtension(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  return 'application/octet-stream';
}

/**
 * GET /api/download?path=<storagePath>
 * Proxies file from Supabase Storage; sets correct filename and Content-Type so downloads play.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path')?.trim() ?? '';
    const path = normalizePath(rawPath);

    if (!path) {
      return NextResponse.json(
        {
          error: rawPath
            ? 'path must be object path only (e.g. projectId/filename.ext).'
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
      console.error('Download (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SECRET_KEY.' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Download signed URL:', error.message);
      return NextResponse.json({ error: error.message || 'Could not create download URL' }, { status: 502 });
    }
    if (!data?.signedUrl) {
      return NextResponse.json({ error: 'Could not create download URL' }, { status: 404 });
    }

    const upstream = await fetch(data.signedUrl);
    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('Download upstream path=%s status=%s body=%s', path, upstream.status, text.slice(0, 200));
      return NextResponse.json(
        { error: `Storage returned ${upstream.status}. ${text.slice(0, 100)}` },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      );
    }

    const upstreamType = upstream.headers.get('content-type') ?? '';
    if (upstreamType.includes('application/json') || upstreamType.includes('text/html')) {
      const text = await upstream.text();
      console.error('Download got JSON/HTML instead of file path=%s', path);
      return NextResponse.json(
        { error: 'Storage returned an error page, not a file.' },
        { status: 502 }
      );
    }

    const filename = filenameFromPath(path);
    const contentType = upstreamType && !upstreamType.includes('octet-stream')
      ? upstreamType
      : contentTypeFromExtension(filename);

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Download:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    );
  }
}
