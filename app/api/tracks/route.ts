import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const BUCKET = 'music-files';

function fileTypeFromPath(path: string): 'mp3' | 'wav' | 'm4a' {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'wav') return 'wav';
  if (ext === 'm4a') return 'm4a';
  return 'mp3';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectId, title, name: nameParam, file_path } = body;
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const name = [nameParam, title].find((n) => typeof n === 'string' && n.trim())?.trim() || 'Untitled';

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

    if (file_path && typeof file_path === 'string') {
      const file_type = fileTypeFromPath(file_path);
      const { data: track, error } = await supabase
        .from('tracks')
        .insert({ project_id: projectId, name, storage_path: file_path, file_type })
        .select()
        .single();
      if (error) {
        console.error('Tracks POST:', error.message);
        return NextResponse.json({ error: error.message || 'Failed to create track' }, { status: 500 });
      }
      return NextResponse.json({ track });
    }

    // Create track without a file (manual "Add track")
    const { data: track, error } = await supabase
      .from('tracks')
      .insert({ project_id: projectId, name, storage_path: null, file_type: 'mp3' })
      .select()
      .single();
    if (error) {
      console.error('Tracks POST (no file):', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to create track. You may need to run: ALTER TABLE tracks ALTER COLUMN storage_path DROP NOT NULL;' },
        { status: 500 }
      );
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
      await supabase.storage.from(BUCKET).remove([track.storage_path]);
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
