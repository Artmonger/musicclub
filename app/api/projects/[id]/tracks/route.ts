import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

/**
 * GET /api/projects/[id]/tracks — list tracks via RPC get_tracks_for_project (SECURITY DEFINER bypasses RLS).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = (params?.id ?? '').trim();
    if (!projectId) {
      return NextResponse.json({ error: 'Project id is required' }, { status: 400 });
    }
    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json({ error: 'Invalid project id: must be a UUID' }, { status: 400 });
    }
    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('Tracks GET (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.rpc('get_tracks_for_project', {
      p_project_id: projectId,
    });

    if (error) {
      console.error('Tracks GET (rpc):', error.message);
      return NextResponse.json(
        { error: `rpc get_tracks_for_project failed: ${error.message}` },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const normalized = rows.map((row: Record<string, unknown>) => ({
      ...row,
      name: row.title ?? row.name,
      storage_path: row.file_path ?? row.storage_path,
      file_path: row.file_path ?? row.storage_path,
    }));

    return NextResponse.json(normalized, {
      headers: {
        ...NO_STORE_HEADERS,
        'X-Project-Id': projectId,
        'X-Track-Count': String(normalized.length),
      },
    });
  } catch (err) {
    console.error('Tracks GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch tracks' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

/**
 * DELETE /api/projects/[id]/tracks — delete all tracks for this project (start over).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = (params?.id ?? '').trim();
    if (!projectId || !UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        { error: 'Valid project id (UUID) is required' },
        { status: 400 }
      );
    }
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('tracks')
      .delete()
      .eq('project_id', projectId)
      .select('id');

    if (error) throw error;
    const deleted = Array.isArray(data) ? data.length : 0;
    console.log('[tracks DELETE] projectId=%s deleted=%d', projectId, deleted);
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error('Tracks DELETE:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to clear tracks' },
      { status: 500 }
    );
  }
}
