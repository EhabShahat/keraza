import { NextResponse } from "next/server";

// Deprecated: Bootstrap via Supabase Auth is no longer supported.
// Use the Admin Settings page to add admins, or seed via SQL/migration.
export async function POST() {
  return NextResponse.json({ error: "bootstrap_deprecated" }, { status: 410 });
}
