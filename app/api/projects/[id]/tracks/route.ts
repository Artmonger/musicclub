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
    let supabase;
    try {
      supabase = createServerSupabase();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : 'Supabase client failed';
      console.error('Tracks GET (env):', msg);
      return NextResponse.json(
        { error: msg + '. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 503 }
      );
    }
    const BUCKET = 'music-files';

    // List files in storage so we only show tracks that have a file (UI = directory of storage)
    const { data: storageData, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(projectId, { limit: 1000 });

    let existingStoragePaths: Set<string> | null = null;
    if (!listError && Array.isArray(storageData)) {
      const fileNames = storageData.filter(
        (item: { name?: string }) => typeof item.name === 'string' && !item.name.startsWith('.')
      );
      existingStoragePaths = new Set(
        fileNames.map((item: { name: string }) => `${projectId}/${item.name}`)
      );
    }

    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    const withFile =
      existingStoragePaths === null
        ? rows
        : rows.filter((row) => {
            const path = (row.file_path ?? row.storage_path) as string | undefined;
            return path && existingStoragePaths!.has(path);
          });
    const normalized = withFile.map((row) => ({
      ...row,
      name: row.title ?? row.name,
      storage_path: row.file_path ?? row.storage_path,
    }));
    return NextResponse.json(normalized, {
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (err) {
    console.error('Tracks GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}
