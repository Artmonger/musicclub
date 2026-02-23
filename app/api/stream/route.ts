import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizeStoragePath } from '@/lib/normalizeStoragePath';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'music-files';
const CACHE_NO_STORE = 'no-store, no-cache, max-age=0, must-revalidate';

function normalizeStreamPath(raw: string): string | null {
  return normalizeStoragePath(raw, BUCKET);
}

function safeFilename(name: string): string {
  const base = name.replace(/[^\w.\-]/g, '_').slice(0, 200) || 'audio';
  return base.endsWith('.mp3') || base.endsWith('.wav') || base.endsWith('.m4a') ? base : `${base}.mp3`;
}

/** Strip leading timestamp from double-timestamp paths (e.g. 1771660361425-1771457986955-foo.m4a -> 1771457986955-foo.m4a). */
function stripDoubleTimestamp(path: string): string | null {
  const match = path.match(/^([^/]+\/)(\d+)-(\d+-.+)$/);
  return match ? match[1] + match[3] : null;
}

/** Extract base filename for matching (strip all leading digit- prefixes). */
function baseFilename(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.replace(/^(\d+-)*/, ''); // strip "123456-" and "123-456-..."
}

/** Find all storage paths that match the track's base filename (handles duplicates/variants). */
async function findStoragePathsBySuffix(
  supabase: ReturnType<typeof import('@/lib/supabase-server').createServerSupabase>,
  projectId: string,
  path: string
): Promise<string[]> {
  const suffix = baseFilename(path);
  if (!suffix) return [];
  const baseNoExt = suffix.replace(/\.(mp3|wav|m4a)$/i, '').toLowerCase();
  const { data: list } = await supabase.storage.from(BUCKET).list(projectId, { limit: 500 });
  const names = (list ?? []).map((o) => (o as { name?: string }).name).filter(Boolean) as string[];
  return names
    .filter((n) => {
      if (n === suffix || n.endsWith(`-${suffix}`)) return true;
      const nBase = n.replace(/\.(mp3|wav|m4a)$/i, '').toLowerCase();
      return nBase === baseNoExt || nBase.endsWith(`-${baseNoExt}`);
    })
    .map((n) => `${projectId}/${n}`);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('id')?.trim() ?? '';
    const rawPath = searchParams.get('path')?.trim() ?? '';
    const isDownload = searchParams.get('download') === '1' || searchParams.get('download') === 'true';

    let path: string | null = null;
    let trackTitle: string | null = null;

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

    if (trackId) {
      const { data: track, error: trackErr } = await supabase
        .from('tracks')
        .select('file_path, title')
        .eq('id', trackId)
        .single();
      if (trackErr || !track?.file_path) {
        return NextResponse.json(
          { error: 'Track not found or has no file' },
          { status: 404, headers: { 'Cache-Control': CACHE_NO_STORE } }
        );
      }
      path = normalizeStreamPath(track.file_path);
      trackTitle = track.title ?? null;
    } else if (rawPath) {
      path = normalizeStreamPath(rawPath);
    }

    if (!path) {
      return NextResponse.json(
        {
          error: trackId
            ? 'Track has invalid file_path'
            : rawPath
              ? 'path must be object path only (e.g. projectId/filename.ext). Do not send full URL or music-files/ prefix.'
              : 'id or path query parameter is required',
        },
        { status: 400, headers: { 'Cache-Control': CACHE_NO_STORE } }
      );
    }

    if (isDownload) {
      const projectId = path.split('/')[0];
      const candidates: string[] = [path];
      const altPath = stripDoubleTimestamp(path);
      if (altPath) candidates.push(altPath);
      const foundPaths = await findStoragePathsBySuffix(supabase, projectId, path);
      for (const fp of foundPaths) {
        if (!candidates.includes(fp)) candidates.push(fp);
      }
      let downloadData: { data: Blob; path: string } | null = null;
      for (const candidate of candidates) {
        const { data, error } = await supabase.storage.from(BUCKET).download(candidate);
        if (!error && data) {
          downloadData = { data, path: candidate };
          break;
        }
      }
      if (!downloadData) {
        return NextResponse.json(
          { error: 'Failed to fetch file for download' },
          { status: 502, headers: { 'Cache-Control': CACHE_NO_STORE } }
        );
      }
      const suggestedName = searchParams.get('filename')?.trim() || trackTitle;
      const filename = safeFilename(suggestedName || downloadData.path.split('/').pop() || 'audio');
      const ext = downloadData.path.split('.').pop()?.toLowerCase() ?? 'mp4';
      const contentType =
        ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4';
      const headers: Record<string, string> = {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
        'Cache-Control': CACHE_NO_STORE,
        'X-Stream-Mode': 'download-direct',
      };
      return new NextResponse(downloadData.data, { status: 200, headers });
    }

    // Playback: use Supabase download() (service-role) instead of signed URL + fetch.
    // Signed URL fetch from Vercel can fail; download uses direct API with auth.
    const projectId = path.split('/')[0];
    const candidates: string[] = [path];
    const altPath = stripDoubleTimestamp(path);
    if (altPath) candidates.push(altPath);
    const foundPaths = await findStoragePathsBySuffix(supabase, projectId, path);
    for (const fp of foundPaths) {
      if (!candidates.includes(fp)) candidates.push(fp);
    }

    let downloadData: { data: Blob; path: string } | null = null;
    for (const candidate of candidates) {
      const { data, error } = await supabase.storage.from(BUCKET).download(candidate);
      if (!error && data && data.size > 0) {
        downloadData = { data, path: candidate };
        console.log('[stream] path=%s resolved via download candidate=%s size=%s', path, candidate, data.size);
        break;
      }
      if (error) console.log('[stream] download candidate=%s error=%s', candidate, error.message);
    }

    if (!downloadData) {
      return NextResponse.json(
        { error: 'File not found in storage. Try re-uploading the track.' },
        { status: 404, headers: { 'Cache-Control': CACHE_NO_STORE } }
      );
    }

    if (trackId && downloadData.path !== path) {
      supabase.from('tracks').update({ file_path: downloadData.path }).eq('id', trackId).then(() => {});
    }
    const ext = downloadData.path.split('.').pop()?.toLowerCase() ?? 'mp4';
    const contentType =
      ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4';
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': CACHE_NO_STORE,
      'Pragma': 'no-cache',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(downloadData.data.size),
    };
    // Use stream to avoid Vercel response body size limits and memory pressure
    const stream = downloadData.data.stream();
    return new NextResponse(stream, { status: 200, headers });
  } catch (err) {
    console.error('Stream:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500, headers: { 'Cache-Control': CACHE_NO_STORE } }
    );
  }
}
