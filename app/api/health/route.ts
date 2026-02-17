import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Health check: confirms Supabase connection works.
 * GET /api/health
 */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .limit(1);

    // If projects doesn't exist yet, you'll get a "relation does not exist" error.
    // That still proves the connection is working.
    return NextResponse.json({
      ok: !error,
      error: error?.message ?? null,
      data: data ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Connection failed',
      data: null,
    });
  }
}
