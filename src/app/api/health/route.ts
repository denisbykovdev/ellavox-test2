import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "ok" });
}
