import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    if (error) {
      console.error('Stream createSignedUrl:', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to create signed URL' },
        { status: 500 }
      );
    }
    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: 'Could not create signed URL' },
        { status: 500 }
      );
    }

    const signedUrl = data.signedUrl;
    console.log('[stream] path=%s download=%s', path, isDownload);

    if (isDownload) {
      const res = await fetch(signedUrl);
      if (res.status === 404) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch file for download' },
          { status: 502 }
        );
      }
      const suggestedName = searchParams.get('filename')?.trim();
      const filename = safeFilename(suggestedName || path.split('/').pop() || 'audio');
      return new NextResponse(res.body, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
          'X-Stream-Mode': 'download-proxy',
        },
      });
    }

    // Playback: redirect so Safari fetches directly from Supabase (Range handled by storage)
    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        'X-Stream-Mode': 'redirect',
      },
    });
  } catch (err) {
    console.error('Stream:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500 }
    );
  }
}
