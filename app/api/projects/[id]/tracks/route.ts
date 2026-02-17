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
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? [], {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('Tracks GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}
