import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseServer(accessToken?: string): SupabaseClient {
  // Read environment at call time to avoid stale values during dev hot-reload
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only

  if (!url || !anon) {
    // eslint-disable-next-line no-console
    console.warn("Supabase URL or anon key is missing in env.");
  }

  // If a user access token is provided, force anon key to ensure RLS evaluates
  // with the caller's JWT claims. Only use service key when no token provided.
  const key = accessToken ? (anon as string) : (service || (anon as string));
  const options = accessToken
    ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    : undefined;
  return createClient(url as string, key, options as any);
}
