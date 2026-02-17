import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_URL and SUPABASE_SECRET_KEY" },
      { status: 503 }
    );
  }
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("projects").select("id").limit(1);
  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    data: data ?? null,
  });
}
