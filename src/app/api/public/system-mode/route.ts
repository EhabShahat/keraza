import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// GET /api/public/system-mode
// Returns the current tri-state mode and disabled message for public consumption.
export async function GET() {
  try {
    const svc = supabaseServer();

    const { data, error } = await svc
      .from("app_config")
      .select("key, value")
      .in("key", ["system_mode", "system_disabled", "system_disabled_message"]);

    if (error) {
      return NextResponse.json({ mode: "exam", message: null, error: error.message }, { status: 200 });
    }

    const map = new Map<string, string>();
    for (const row of data || []) {
      map.set((row as any).key, (row as any).value);
    }

    const legacyDisabled = map.get("system_disabled") === "true";
    const mode = (map.get("system_mode") as "exam" | "results" | "disabled" | undefined) || (legacyDisabled ? "disabled" : "exam");
    const message = map.get("system_disabled_message") || "No exams are currently available. Please check back later.";

    return NextResponse.json({ mode, message }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ mode: "exam", message: null, error: e?.message || "unexpected_error" }, { status: 200 });
  }
}
