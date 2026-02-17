import { NextResponse } from 'next/server';
import { getSupabaseHost } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabaseHost = getSupabaseHost();
  const supabaseUrl = process.env.SUPABASE_URL;
  return NextResponse.json(
    {
      supabaseHost,
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
      note: 'Server routes use only SUPABASE_URL + SUPABASE_SECRET_KEY (no NEXT_PUBLIC fallback).',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

