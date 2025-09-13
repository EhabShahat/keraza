import { NextResponse } from "next/server";
import { getCodeFormatSettings } from "@/lib/codeGenerator";

export async function GET() {
  try {
    const settings = await getCodeFormatSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching code settings:", error);
    return NextResponse.json(
      {
        code_length: 4,
        code_format: "numeric",
        code_pattern: null,
      },
      { status: 500 }
    );
  }
}
