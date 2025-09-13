import { NextResponse } from "next/server";

export async function POST() {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `auth_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers });
}
