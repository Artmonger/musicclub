import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'music-files';

const ALLOWED = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'application/octet-stream', ''];

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'audio';
}

/**
 * POST /api/uploads/create
 * Body: { projectId, filename, contentType }
 * Returns: { path, signedUrl, token } for client PUT upload.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectId, filename, contentType } = body;
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }
    const ct = (typeof contentType === 'string' ? contentType.trim() : '') || 'audio/mpeg';
    if (!ALLOWED.includes(ct) && !ALLOWED.includes(ct.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid contentType. Allowed: mp3, wav, m4a' }, { status: 400 });
    }

    const base = filename.replace(/\.[^.]+$/, '').trim() || 'audio';
    const ext = filename.split('.').pop()?.toLowerCase() || 'mp3';
    const path = `${projectId}/${Date.now()}-${sanitize(base)}.${ext}`;

    const supabase = createServerSupabase();
    console.log('[uploads/create] start', {
      projectId,
      filename,
      contentType: ct,
      path,
    });
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error) {
      console.error('[uploads/create] error', error.message);
      return NextResponse.json({ error: error.message || 'Failed to create upload URL' }, { status: 502 });
    }

    const signedUrl = data?.signedUrl ?? (data as { signed_url?: string })?.signed_url;
    const token = data?.token;
    if (!signedUrl || !token) {
      console.error('[uploads/create] invalid response', data);
      return NextResponse.json({ error: 'Invalid response from storage' }, { status: 502 });
    }

    const response = {
      path: data?.path ?? path,
      signedUrl,
      token,
    };
    console.log('[uploads/create] success', { projectId, filename, path: response.path });

    return NextResponse.json(response);
  } catch (err) {
    console.error('[uploads/create] unexpected', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload create failed' },
      { status: 500 }
    );
  }
}
