import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

type AdminTokenPayload = {
  sub: string;
  email?: string | null;
  username?: string | null;
  is_admin?: boolean;
  iat?: number;
  exp?: number;
};

function getAuthSecret() {
  // Prefer explicit secret; fall back to NEXTAUTH_SECRET; dev fallback last.
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-secret-do-not-use-in-prod"
  );
}

export async function getBearerToken(_req: NextRequest): Promise<string | null> {
  // Do not forward our app JWT to Supabase — it's not a Supabase JWT.
  return null;
}

export async function requireAdmin(req: NextRequest): Promise<{ user_id: string; email: string | null; username?: string | null }>
{
  const cookie = req.cookies.get("auth_token")?.value;
  if (!cookie) {
    throw NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(getAuthSecret());
    const { payload } = await jwtVerify(cookie, secret);
    const p = payload as AdminTokenPayload;
    if (!p?.sub || p.is_admin !== true) {
      throw NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return { user_id: p.sub, email: p.email ?? null, username: p.username ?? undefined };
  } catch (e) {
    // Invalid/expired token
    throw NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
