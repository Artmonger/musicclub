import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/debug/tracks-by-project?projectId=<uuid>
 * Calls get_tracks_for_project RPC and returns count + first track ids. No localStorage; Supabase DB only.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')?.trim() ?? '';
    if (!projectId || !UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        { error: 'projectId query param required and must be a valid UUID' },
        { status: 400 }
      );
    }
    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc('get_tracks_for_project', { p_project_id: projectId });
    if (error) {
      return NextResponse.json(
        { error: error.message, projectId, count: 0, ids: [] },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }
    const rows = Array.isArray(data) ? data : [];
    const ids = rows.slice(0, 10).map((r: { id?: string }) => r?.id).filter(Boolean);
    return NextResponse.json(
      { projectId, count: rows.length, ids },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed', count: 0, ids: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
