import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/** GET: projects for artist (require artistId query param) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const artistId = searchParams.get('artistId');
    if (!artistId) {
      return NextResponse.json({ error: 'artistId query param is required' }, { status: 400, headers: NO_STORE });
    }
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json(data ?? [], { headers: NO_STORE });
  } catch (err) {
    console.error('Projects GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch projects' },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** POST: create project { artistId, name } */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { artistId, name } = body;
    if (!artistId || typeof artistId !== 'string') {
      return NextResponse.json({ error: 'artistId is required' }, { status: 400, headers: NO_STORE });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400, headers: NO_STORE });
    }
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('projects')
      .insert({ artist_id: artistId, name: name.trim() })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error('Projects POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create project' },
      { status: 500, headers: NO_STORE }
    );
  }
}
