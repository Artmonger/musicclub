import { NextResponse } from 'next/server';
import { createServerSupabase, getSupabaseHost } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Returns total row count in tracks table (no project filter) and Supabase host (from SUPABASE_URL only).
 * If total is 0 but you have rows in Supabase, set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel to match your dashboard.
 */
export async function GET() {
  const supabaseHost = getSupabaseHost();
  try {
    const supabase = createServerSupabase();
    const { count, error } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        { error: error.message, total: null, supabaseHost },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { total: count ?? 0, supabaseHost },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed', total: null, supabaseHost },
      { status: 500 }
    );
  }
}
