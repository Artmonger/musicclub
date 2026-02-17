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
    console.log('[debug/storage] list objects start', { projectId });

    const { data, error } = await supabase.storage
      .from('music-files')
      .list(projectId, { limit: 1000 });

    if (error) {
      console.error('[debug/storage] list error', error.message);
      return NextResponse.json({ error: error.message || 'Failed to list storage objects' }, { status: 500 });
    }

    console.log('[debug/storage] list objects success', { projectId, count: data?.length ?? 0 });
    return NextResponse.json(
      { projectId, objects: data ?? [] },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('[debug/storage] unexpected', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list storage objects' },
      { status: 500 }
    );
  }
}

