import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Returns total row count in tracks table (no project filter).
 * Use this to verify the server can see your Supabase data at all.
 * If total is 0 but you have rows in Supabase, check Vercel env (same project URL + service role key).
 */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { count, error } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({ error: error.message, total: null }, { status: 500 });
    }
    return NextResponse.json(
      { total: count ?? 0 },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed', total: null },
      { status: 500 }
    );
  }
}
