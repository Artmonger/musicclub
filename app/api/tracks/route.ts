import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const BUCKET = 'music-files';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectId, title, name: nameParam, file_path } = body;
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!file_path || typeof file_path !== 'string') {
      return NextResponse.json({ error: 'file_path is required' }, { status: 400 });
    }
    const titleVal = [nameParam, title].find((n) => typeof n === 'string' && n.trim())?.trim() || 'Untitled';

    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 503 }
      );
    }

    const { data: track, error } = await supabase
      .from('tracks')
      .insert({ project_id: projectId, title: titleVal, file_path })
      .select()
      .single();
    if (error) {
      console.error('Tracks POST:', error.message);
      return NextResponse.json({ error: error.message || 'Failed to create track' }, { status: 500 });
    }
    return NextResponse.json({ track });
  } catch (err) {
    console.error('Tracks POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create track' },
      { status: 500 }
    );
  }
}

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
    if (typeof name === 'string') updates.title = name;

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
      .select('file_path')
      .eq('id', id)
      .single();

    if (track?.file_path) {
      await supabase.storage.from(BUCKET).remove([track.file_path]);
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
