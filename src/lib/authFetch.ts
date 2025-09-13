"use client";

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers as any);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  // Rely on httpOnly cookie (auth_token); don't attach Authorization on client.
  return fetch(input, { ...init, headers, credentials: "include" });
}
