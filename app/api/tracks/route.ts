import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, bpm, key, notes, name } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const updates: Record<string, unknown> = {};
    if (typeof bpm === 'number') updates.bpm = bpm;
    if (typeof key === 'string') updates.key = key;
    if (typeof notes === 'string') updates.notes = notes;
    if (typeof name === 'string') updates.name = name;

    const { data, error } = await supabase
      .from('tracks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Track PATCH:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update track' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: track } = await supabase
      .from('tracks')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (track?.storage_path) {
      await supabase.storage.from('Music Files').remove([track.storage_path]);
    }

    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Track DELETE:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete track' },
      { status: 500 }
    );
  }
}
