import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

// POST /api/admin/system/mode
// Body: { mode: 'exam' | 'results' | 'disabled', message?: string }
// Persists tri-state system mode in app_config and updates legacy system_disabled flag for compatibility.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const body = await req.json();
    const mode = body?.mode as 'exam' | 'results' | 'disabled' | undefined;
    const message = (body?.message as string | undefined)?.trim();

    if (!mode || !['exam', 'results', 'disabled'].includes(mode)) {
      return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
    }

    // Upsert system_mode
    const upserts: Array<{ key: string; value: string; updated_at: string }> = [
      { key: 'system_mode', value: mode, updated_at: new Date().toISOString() },
      { key: 'system_disabled', value: mode === 'disabled' ? 'true' : 'false', updated_at: new Date().toISOString() },
    ];

    if (mode === 'disabled' && message) {
      upserts.push({ key: 'system_disabled_message', value: message, updated_at: new Date().toISOString() });
    }

    const { error } = await svc.from('app_config').upsert(upserts);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, mode });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 });
  }
}
