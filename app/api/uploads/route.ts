import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
const MAX_SIZE_BYTES = 4.5 * 1024 * 1024; // ~4.5MB safe for serverless fallback

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const title = (formData.get('title') as string) || file?.name?.replace(/\.[^.]+$/, '') || 'Untitled';

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'file and projectId are required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large for serverless fallback (max ~${Math.round(MAX_SIZE_BYTES / (1024 * 1024))}MB)` },
        { status: 413 }
      );
    }

    const mime = file.type || 'application/octet-stream';
    if (mime && !ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: mp3, wav, m4a' },
        { status: 400 }
      );
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `${projectId}/${safeName}`;

    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('[uploads] env error', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 503 }
      );
    }

    console.log('[uploads] start', {
      projectId,
      filename: file.name,
      filePath,
      size: file.size,
      type: mime,
    });

    const { error: uploadError } = await supabase.storage
      .from('music-files')
      .upload(filePath, file, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      console.error('[uploads] storage error', uploadError.message);
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 }
      );
    }

    const { data: track, error: insertError } = await supabase
      .from('tracks')
      .insert({
        project_id: projectId,
        title,
        file_path: filePath,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[uploads] DB insert error', insertError.message);
      await supabase.storage.from('music-files').remove([filePath]);
      return NextResponse.json(
        { error: insertError.message || 'Failed to create track' },
        { status: 500 }
      );
    }

    console.log('[uploads] success', { projectId, filePath, trackId: track?.id });

    return NextResponse.json(
      { track },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('[uploads] unexpected', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

