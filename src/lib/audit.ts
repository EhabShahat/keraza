import { supabaseServer } from "@/lib/supabase/server";

export async function auditLog(actor: string, action: string, meta: Record<string, unknown> = {}) {
  try {
    const svc = supabaseServer();
    await svc.from("audit_logs").insert({ actor, action, meta });
  } catch {
    // best effort
  }
}
