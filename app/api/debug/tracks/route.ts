import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    console.log('[debug/tracks] list rows start', { projectId });

    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[debug/tracks] select error', error.message);
      return NextResponse.json({ error: error.message || 'Failed to list tracks' }, { status: 500 });
    }

    console.log('[debug/tracks] list rows success', { projectId, count: data?.length ?? 0 });
    return NextResponse.json(
      { projectId, tracks: data ?? [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (err) {
    console.error('[debug/tracks] unexpected', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list tracks' },
      { status: 500 }
    );
  }
}

