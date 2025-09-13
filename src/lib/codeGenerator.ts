import { supabaseServer } from "@/lib/supabase/server";

export interface CodeFormatSettings {
  code_length: number;
  code_format: "numeric" | "alphabetic" | "alphanumeric" | "custom";
  code_pattern?: string | null;
  enable_multi_exam?: boolean;
}

export async function getCodeFormatSettings(): Promise<CodeFormatSettings> {
  try {
    const svc = supabaseServer();
    const { data, error } = await svc
      .from("app_settings")
      .select("code_length, code_format, code_pattern, enable_multi_exam")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("Failed to fetch code format settings, using defaults:", error);
    }

    return {
      code_length: data?.code_length ?? 4,
      code_format: data?.code_format ?? "numeric",
      code_pattern: data?.code_pattern ?? null,
      enable_multi_exam: data?.enable_multi_exam ?? true,
    };
  } catch (error) {
    console.warn("Error fetching code format settings, using defaults:", error);
    return {
      code_length: 4,
      code_format: "numeric",
      code_pattern: null,
      enable_multi_exam: true,
    };
  }
}

export function generateRandomCode(settings: CodeFormatSettings): string {
  const { code_length, code_format, code_pattern } = settings;

  if (code_format === "custom" && code_pattern) {
    return generateFromPattern(code_pattern);
  }

  let characters = "";
  switch (code_format) {
    case "numeric":
      characters = "0123456789";
      break;
    case "alphabetic":
      characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      break;
    case "alphanumeric":
      characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      break;
    default:
      characters = "0123456789"; // fallback to numeric
  }

  let result = "";
  for (let i = 0; i < code_length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateFromPattern(pattern: string): string {
  let result = "";
  
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    
    switch (char) {
      case "N": // Number
        result += Math.floor(Math.random() * 10).toString();
        break;
      case "A": // Letter
        result += String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
        break;
      case "#": // Any alphanumeric
        const alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        result += alphanumeric.charAt(Math.floor(Math.random() * alphanumeric.length));
        break;
      default: // Literal character
        result += char;
    }
  }
  
  return result;
}

export function validateCodeFormat(code: string, settings: CodeFormatSettings): boolean {
  const { code_length, code_format, code_pattern } = settings;

  if (code_format === "custom" && code_pattern) {
    return validateAgainstPattern(code, code_pattern);
  }

  // Check length
  if (code.length !== code_length) {
    return false;
  }

  // Check format
  switch (code_format) {
    case "numeric":
      return /^\d+$/.test(code);
    case "alphabetic":
      return /^[A-Z]+$/i.test(code);
    case "alphanumeric":
      return /^[A-Z0-9]+$/i.test(code);
    default:
      return /^\d+$/.test(code); // fallback to numeric
  }
}

function validateAgainstPattern(code: string, pattern: string): boolean {
  if (code.length !== pattern.length) {
    return false;
  }

  for (let i = 0; i < pattern.length; i++) {
    const patternChar = pattern[i];
    const codeChar = code[i];

    switch (patternChar) {
      case "N": // Should be number
        if (!/\d/.test(codeChar)) return false;
        break;
      case "A": // Should be letter
        if (!/[A-Z]/i.test(codeChar)) return false;
        break;
      case "#": // Should be alphanumeric
        if (!/[A-Z0-9]/i.test(codeChar)) return false;
        break;
      default: // Should be literal character
        if (codeChar !== patternChar) return false;
    }
  }

  return true;
}

export function getCodeValidationRegex(settings: CodeFormatSettings): RegExp {
  const { code_length, code_format, code_pattern } = settings;

  if (code_format === "custom" && code_pattern) {
    return patternToRegex(code_pattern);
  }

  switch (code_format) {
    case "numeric":
      return new RegExp(`^\\d{${code_length}}$`);
    case "alphabetic":
      return new RegExp(`^[A-Z]{${code_length}}$`, "i");
    case "alphanumeric":
      return new RegExp(`^[A-Z0-9]{${code_length}}$`, "i");
    default:
      return new RegExp(`^\\d{${code_length}}$`); // fallback to numeric
  }
}

function patternToRegex(pattern: string): RegExp {
  let regexPattern = "^";
  
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    
    switch (char) {
      case "N":
        regexPattern += "\\d";
        break;
      case "A":
        regexPattern += "[A-Z]";
        break;
      case "#":
        regexPattern += "[A-Z0-9]";
        break;
      default:
        // Escape special regex characters
        regexPattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  
  regexPattern += "$";
  return new RegExp(regexPattern, "i");
}
