import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Single source of truth for track list. Supabase DB only; no static/cache.
 * GET /api/projects/[projectId]/tracks — always queries Supabase; never cached.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
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

    // Diagnostic: can we see any rows at all? (unfiltered count)
    const { count: tableCount } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    console.log('[tracks GET] projectId=%s count=%s tableTotal=%s', projectId, rows.length, tableCount ?? '?');
    const normalized = rows.map((row) => ({
      ...row,
      name: row.title ?? row.name,
      storage_path: row.file_path ?? row.storage_path,
      file_path: row.file_path ?? row.storage_path,
    }));
    return NextResponse.json(normalized, {
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Track-Count': String(normalized.length),
        'X-Project-Id': projectId,
        'X-Tracks-Table-Total': String(tableCount ?? ''),
      },
    });
  } catch (err) {
    console.error('Tracks GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}
