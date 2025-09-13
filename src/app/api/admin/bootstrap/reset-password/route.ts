import { NextResponse } from "next/server";

// Deprecated: Supabase Auth password reset is removed.
export async function POST() {
  return NextResponse.json({ error: "bootstrap_deprecated" }, { status: 410 });
}
