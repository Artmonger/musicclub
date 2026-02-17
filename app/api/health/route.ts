import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = supabaseServer();

  // Simple "does Supabase respond?" call
  const { data, error } = await supabase.from("projects").select("id").limit(1);

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    data: data ?? null,
  });
}
