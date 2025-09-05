import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const { attemptId } = await ctx.params;
    if (!attemptId) return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

    const svc = supabaseServer();

    // Basic validation: attempt exists and is not submitted yet
    const att = await svc
      .from("exam_attempts")
      .select("id, completion_status")
      .eq("id", attemptId)
      .maybeSingle();
    if (att.error) return NextResponse.json({ error: att.error.message }, { status: 400 });
    if (!att.data) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    if (att.data.completion_status === "submitted") {
      return NextResponse.json({ error: "attempt_submitted" }, { status: 400 });
    }
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `attempts/${attemptId}/ans-${ts}-${rand}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await svc.storage
      .from("answer-images")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message || "upload_failed" }, { status: 500 });

    const { data: urlData } = svc.storage.from("answer-images").getPublicUrl(path);
    const url = urlData?.publicUrl;
    if (!url) return NextResponse.json({ error: "url_error" }, { status: 500 });

    return NextResponse.json({ ok: true, url, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
