import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Expose ONLY non-secret env so we can verify which Supabase project the server uses
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
    {
      supabaseHost,
      supabaseUrlPrefix: supabaseUrl ? `${supabaseUrl.slice(0, 40)}…` : null,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
      hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

