import { authFetch } from "@/lib/authFetch";
import { StudentPayload } from "./types";

/**
 * Adds a new student to the system
 */
export async function addStudent(payload: StudentPayload) {
  const res = await authFetch(`/api/admin/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  const result = await res.json();
  if (!res.ok) throw new Error(result?.error || "Failed to add student");
  return result.student;
}