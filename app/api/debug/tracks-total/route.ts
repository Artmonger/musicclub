import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Returns total row count in tracks table (no project filter) and which Supabase host we're using.
 * If total is 0 but you have rows in Supabase, Vercel is using a different project — set SUPABASE_URL and SUPABASE_SECRET_KEY to match your dashboard (Settings → API).
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    let supabaseHost: string | null = null;
    if (supabaseUrl) {
      try {
        supabaseHost = new URL(supabaseUrl).hostname;
      } catch {
        supabaseHost = null;
      }
    }

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
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    let supabaseHost: string | null = null;
    if (supabaseUrl) {
      try {
        supabaseHost = new URL(supabaseUrl).hostname;
      } catch {
        supabaseHost = null;
      }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed', total: null, supabaseHost },
      { status: 500 }
    );
  }
}
