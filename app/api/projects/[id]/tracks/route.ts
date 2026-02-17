import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 503 }
      );
    }
    // Always read current state from Supabase so UI matches backend (e.g. after deleting in dashboard)
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data ?? [];
    const normalized = rows.map((row: Record<string, unknown>) => ({
      ...row,
      name: row.title ?? row.name,
      storage_path: row.file_path ?? row.storage_path,
    }));
    return NextResponse.json(normalized, {
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache',
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
