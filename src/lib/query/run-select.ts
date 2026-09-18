import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function executeReadonlyQuery(
  sql: string,
): Promise<Record<string, unknown>[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("execute_readonly_query", {
    query: sql,
  });

  if (error) {
    throw new Error(error.message || "Failed to execute query");
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data as Record<string, unknown>[];
}
