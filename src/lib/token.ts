export type JWTPayload = Record<string, unknown>;

// Lightweight stubs to avoid external dependency while login is disabled.
export async function signToken(payload: JWTPayload, expiresInSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds, iss: "exam-app", aud: "authenticated" };
  return Buffer.from(JSON.stringify(body)).toString("base64url");
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const payload = JSON.parse(json) as JWTPayload;
    return payload;
  } catch {
    return {} as JWTPayload;
  }
}
