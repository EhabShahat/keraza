import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { SignJWT } from "jose";

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-secret-do-not-use-in-prod"
  );
}

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json().catch(() => ({}));
    if (!identifier || !password || typeof identifier !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const sb = supabaseServer();
    const { data, error } = await sb.rpc("auth_login", {
      p_identifier: identifier,
      p_password: password,
    });

    if (error) {
      // Map known custom errors
      const msg = (error as any)?.message || "auth_failed";
      if (msg.includes("invalid_credentials")) {
        return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const row = Array.isArray(data) ? (data[0] as any) : (data as any);
    if (!row) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    if (row.is_admin !== true) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const payload = {
      sub: row.user_id as string,
      email: row.email as string | null,
      username: row.username as string | null,
      is_admin: true,
    };

    const secret = new TextEncoder().encode(getAuthSecret());
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(secret);

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `auth_token=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    );

    return new NextResponse(JSON.stringify({ ok: true, user: payload }), {
      status: 200,
      headers,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
