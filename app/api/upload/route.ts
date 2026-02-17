import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
const EXT_MAP: Record<string, 'mp3' | 'wav' | 'm4a'> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const name = (formData.get('name') as string) || file?.name?.replace(/\.[^.]+$/, '') || 'Untitled';

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'file and projectId are required' },
        { status: 400 }
      );
    }

    const mime = file.type;
    const fileType = EXT_MAP[mime];
    if (!fileType || !ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: mp3, wav, m4a' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || fileType;
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `${projectId}/${safeName}`;

    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('Upload (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 503 }
      );
    }
    const { error: uploadError } = await supabase.storage
      .from('music-files')
      .upload(storagePath, file, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: track, error: insertError } = await supabase
      .from('tracks')
      .insert({
        project_id: projectId,
        title: name,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from('music-files').remove([storagePath]);
      throw insertError;
    }

    return NextResponse.json(track);
  } catch (err) {
    console.error('Upload:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
