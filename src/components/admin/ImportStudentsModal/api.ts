import { authFetch } from "@/lib/authFetch";
import { StudentItem, ImportResult } from "./types";

/**
 * Imports students in bulk to the system
 */
export async function importStudents(items: StudentItem[]): Promise<ImportResult> {
  const res = await authFetch(`/api/admin/students/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  
  const result = await res.json();
  if (!res.ok) throw new Error(result?.error || "Failed to import students");
  return result as ImportResult;
}