import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Expose ONLY non-secret env so we can verify which Supabase project
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  return NextResponse.json(
    {
      supabaseUrlPrefix: supabaseUrl ? `${supabaseUrl.slice(0, 30)}…` : null,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
      hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRoleKeyFallback: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

