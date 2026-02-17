import { NextResponse } from 'next/server';
import { createServerSupabase, getSupabaseHost } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Single source of truth: track list from Supabase via RPC get_tracks_for_project (SECURITY DEFINER bypasses RLS).
 * GET /api/projects/[id]/tracks — folder [id]; param key params.id; validated as UUID.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = (params?.id ?? '').trim();
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project id is required' },
        { status: 400 }
      );
    }
    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project id: must be a UUID' },
        { status: 400 }
      );
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

    const host = getSupabaseHost();
    const hasSecretKey = Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
    console.log('[tracks GET] projectId=%s supabaseHost=%s hasSecretKey=%s', projectId, host ?? '(none)', hasSecretKey);

    const [
      { count: tracksTotal },
      { data: rpcRows, error: rpcError },
      { data: recentRows },
    ] = await Promise.all([
      supabase.from('tracks').select('*', { count: 'exact', head: true }),
      supabase.rpc('get_tracks_for_project', { p_project_id: projectId }),
      supabase
        .from('tracks')
        .select('project_id')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (rpcError) throw rpcError;
    const rows = (Array.isArray(rpcRows) ? rpcRows : []) as Record<string, unknown>[];
    const total = tracksTotal ?? 0;
    const recentProjectIds = (recentRows ?? []).map((r: { project_id?: string }) => r?.project_id ?? '').filter(Boolean);
    const recentProjectIdsHeader = recentProjectIds.slice(0, 3).join(',');

    const normalized = rows.map((row) => ({
      ...row,
      name: row.title ?? row.name,
      storage_path: row.file_path ?? row.storage_path,
      file_path: row.file_path ?? row.storage_path,
    }));

    const headers: Record<string, string> = {
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Project-Id': projectId,
      'X-Track-Count': String(normalized.length),
      'X-Tracks-Total': String(total),
      'X-Recent-Project-Ids': recentProjectIdsHeader,
      'X-Supabase-Host': host ?? '',
    };

    return NextResponse.json(normalized, { headers });
  } catch (err) {
    console.error('Tracks GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}
