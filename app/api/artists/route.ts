import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function supabase() {
  return createServerSupabase();
}

/** GET: all artists ordered by created_at desc */
export async function GET() {
  try {
    const { data, error } = await supabase()
      .from('artists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json(data ?? [], { headers: NO_STORE });
  } catch (err) {
    console.error('Artists GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch artists' },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** POST: create artist { name } */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400, headers: NO_STORE });
    }
    const { data, error } = await supabase()
      .from('artists')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error('Artists POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create artist' },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** PATCH: update artist { id, name } */
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, name } = body;
    if (!id || typeof id !== 'string' || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400, headers: NO_STORE });
    }
    const { data, error } = await supabase()
      .from('artists')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error('Artists PATCH:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update artist' },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** DELETE: delete artist by ?id=... (cascades to projects + tracks) */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400, headers: NO_STORE });

    const { error } = await supabase().from('artists').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (err) {
    console.error('Artists DELETE:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete artist' },
      { status: 500, headers: NO_STORE }
    );
  }
}
