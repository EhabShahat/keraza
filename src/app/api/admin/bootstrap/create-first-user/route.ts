import { NextResponse } from "next/server";

// Deprecated: Supabase Auth bootstrap is removed in favor of custom users table.
export async function POST() {
  return NextResponse.json({ error: "bootstrap_deprecated" }, { status: 410 });
}
