import { NextResponse } from 'next/server';
import { createServerSupabase, getSupabaseSafeInfo } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/supabase-info
 * Diagnostic: prove whether reads/writes hit the same Supabase project. Never returns secret key.
 */
export async function GET() {
  const safe = getSupabaseSafeInfo();
  const supabaseUrlHost = safe.host;
  const hasSecretKey = safe.hasSecretKey;

  try {
    const supabase = createServerSupabase();
    const [projectsCountRes, tracksCountRes, latestTracksRes] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('tracks').select('*', { count: 'exact', head: true }),
      supabase
        .from('tracks')
        .select('id, project_id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const projectsTotal = projectsCountRes.count ?? 0;
    const tracksTotal = tracksCountRes.count ?? 0;
    const latestTracks = (latestTracksRes.data ?? []) as { id: string; project_id: string; title: string; created_at: string }[];

    if (latestTracksRes.error) {
      return NextResponse.json(
        {
          supabaseUrlHost,
          hasSecretKey,
          error: latestTracksRes.error.message,
          counts: { projectsTotal, tracksTotal },
          latestTracks: [],
        },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    return NextResponse.json(
      {
        supabaseUrlHost,
        hasSecretKey,
        counts: { projectsTotal, tracksTotal },
        latestTracks,
        note: 'If tracksTotal > 0 but GET /api/projects/[id]/tracks returns [], compare project_id in latestTracks to the id in your project URL.',
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        supabaseUrlHost,
        hasSecretKey,
        error: err instanceof Error ? err.message : 'Failed',
        counts: { projectsTotal: null, tracksTotal: null },
        latestTracks: [],
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
