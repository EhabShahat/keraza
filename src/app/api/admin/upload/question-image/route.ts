import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// TEMP: open endpoint similar to logo upload; tighten with requireAdmin later
export async function POST(request: NextRequest) {
  try {
    const svc = supabaseServer();

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPEG, PNG, GIF, WebP, or SVG image." },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Please upload an image smaller than 5MB." },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = file.name.split(".").pop() || "png";
    const fileName = `qimg-${timestamp}-${rand}.${ext}`;

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

    const { error: uploadErr } = await svc.storage
      .from("question-images")
      .upload(fileName, bytes, { contentType: file.type, upsert: false });
    if (uploadErr) {
      console.error("question-image upload error:", uploadErr);
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
    }

    const { data: urlData } = svc.storage.from("question-images").getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      return NextResponse.json({ error: "Failed to get public URL" }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: urlData.publicUrl, fileName });
  } catch (e) {
    console.error("question-image upload exception:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
