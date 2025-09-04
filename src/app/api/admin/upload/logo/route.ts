import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// TODO: Re-enable admin authentication when admin system is fully implemented
// Currently allowing anyone to upload logos for development purposes

export async function POST(request: NextRequest) {
  try {
    // TEMPORARY: Skip authentication check for development
    // TODO: Uncomment and fix when admin authentication is ready
    /*
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    */

    const svc = supabaseServer(); // Use without token for now

    // Get form data
    const formData = await request.formData();
    const file = formData.get("logo") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Please upload a JPEG, PNG, GIF, WebP, or SVG image." 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: "File too large. Please upload an image smaller than 5MB." 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `logo-${timestamp}.${fileExtension}`;

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Upload to Supabase storage
    const { data, error } = await svc.storage
      .from("logos")
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error("Supabase storage error:", error);
      return NextResponse.json({ 
        error: "Failed to upload file to storage" 
      }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = svc.storage
      .from("logos")
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return NextResponse.json({ 
        error: "Failed to get public URL" 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      url: urlData.publicUrl,
      fileName: fileName
    });

  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // TEMPORARY: Skip authentication check for development
    // TODO: Uncomment and fix when admin authentication is ready
    /*
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    */

    const svc = supabaseServer(); // Use without token for now
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    
    if (!fileName) {
      return NextResponse.json({ error: "No file name provided" }, { status: 400 });
    }

    // Delete from Supabase storage
    const { error } = await svc.storage
      .from("logos")
      .remove([fileName]);

    if (error) {
      console.error("Supabase storage delete error:", error);
      return NextResponse.json({ 
        error: "Failed to delete file from storage" 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Logo delete error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}