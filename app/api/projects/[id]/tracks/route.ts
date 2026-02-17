import { NextResponse } from 'next/server';
import { createServerSupabase, getSupabaseSafeInfo } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Single source of truth for track list. Supabase DB only; no static/cache.
 * GET /api/projects/[id]/tracks — param key is "id" (matches folder [id]); always queries Supabase; never cached.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = (params?.id ?? '').trim();
    const safe = getSupabaseSafeInfo();
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project id is required' },
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

    const { count: tracksTotal } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });
    const tableTotal = tracksTotal ?? 0;

    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];

    console.log('[tracks GET] projectId=%s tracksTotal=%s supabaseUrlHost=%s filteredCount=%s', projectId, tableTotal, safe.host, rows.length);

    if (tableTotal > 0 && rows.length === 0) {
      const { data: latestRows } = await supabase
        .from('tracks')
        .select('id, project_id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      const projectIds = (latestRows ?? []).map((r: { project_id?: string }) => r?.project_id);
      console.warn('[tracks GET] tracksTotal>0 but filtered=0 — sample project_ids in DB:', projectIds);
    }

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
      'X-Tracks-Table-Total': String(tableTotal),
      'X-Supabase-Host': safe.host ?? '',
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
