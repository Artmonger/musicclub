import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/tracks-all
 * Returns ALL tracks in the table (id, project_id, title, created_at).
 * Use this to verify: (1) tracks exist after upload, (2) their project_id matches the project page you're on.
 * If you see tracks with a different project_id than your URL, the app is using the wrong id somewhere.
 */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('tracks')
      .select('id, project_id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: error.message, tracks: [] },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const totalRes = await supabase.from('tracks').select('*', { count: 'exact', head: true });
    const total = totalRes.count ?? (data?.length ?? 0);

    return NextResponse.json(
      {
        total,
        hint: 'If total > 0 but your project shows 0 tracks, compare project_id here with the project id in your URL.',
        tracks: (data ?? []) as { id: string; project_id: string; title: string; created_at: string }[],
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed', tracks: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
