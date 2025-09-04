import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    console.log("Public settings API called");
    
    // Use service role key for public access to settings
    const svc = supabaseServer();
    
    // Fetch app settings (public information only)
    // Try to select all columns first, then fall back to basic columns
    let { data, error } = await svc
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // If there's a column error, try with just basic columns
    if (error && error.code === "42703") {
      console.log("Column error detected, trying with basic columns only");
      const result = await svc
        .from("app_settings")
        .select(
          [
            "brand_name",
            "brand_logo_url",
            "default_language",
            "welcome_instructions",
            "welcome_instructions_ar",
            "thank_you_title",
            "thank_you_title_ar",
            "thank_you_message",
            "thank_you_message_ar",
            "enable_name_search",
            "enable_code_search",
          ].join(", ")
        )
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error;

      // If still missing columns, try minimal safe subset
      if (error && error.code === "42703") {
        console.log("Secondary fallback: selecting minimal columns");
        const result2 = await svc
          .from("app_settings")
          .select(["brand_name", "brand_logo_url"].join(", "))
          .limit(1)
          .maybeSingle();
        data = result2.data;
        error = result2.error;
      }
    }

    console.log("Supabase query result:", { data, error });

    if (error) {
      console.error("Supabase error:", error);
      
      // If table doesn't exist, return empty object
      if (error.code === "42P01") {
        console.log("app_settings table doesn't exist, returning empty object");
        return NextResponse.json({});
      }
      
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return empty object if no settings found
    const result = data || {};
    console.log("Returning settings:", result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Public settings API error:", e);
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}