import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    // If requireAdmin threw a Response, return it directly
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
