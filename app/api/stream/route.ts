import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Returns a short-lived signed URL for streaming an audio file.
 * Client uses this URL in the audio player; no Supabase keys are exposed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path')?.trim();
    const expiresIn = 3600; // 1 hour

    if (!path || path === 'undefined') {
      return NextResponse.json(
        { error: 'path query parameter is required' },
        { status: 400 }
      );
    }
    // Storage path must be "projectId/filename.ext" – not just project id
    if (!path.includes('/')) {
      console.error('Stream: invalid path (expected projectId/filename)', path);
      return NextResponse.json(
        { error: 'Invalid path: expected projectId/filename.ext' },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('Stream (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.' },
        { status: 503 }
      );
    }
    const { data, error } = await supabase.storage
      .from('music-files')
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    if (!data?.signedUrl) {
      return NextResponse.json({ error: 'Could not create signed URL' }, { status: 404 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error('Stream signed URL:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get stream URL' },
      { status: 500 }
    );
  }
}
