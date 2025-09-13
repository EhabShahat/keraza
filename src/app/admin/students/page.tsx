"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";

interface Student {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number: string | null;
  student_created_at: string;
  total_exams_attempted?: number;
  completed_exams?: number;
  in_progress_exams?: number;
}

export default function GlobalStudentsPage() {
  // Spinner style
  const spinnerStyle = `
    .spinner {
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-left-color: currentColor;
      border-radius: 50%;
      display: inline-block;
      animation: spinner 0.75s linear infinite;
    }
    
    @keyframes spinner {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  const qc = useQueryClient();
  const toast = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  
  // Function to send WhatsApp message
  function sendWhatsApp(student: any) {
    if (!student.mobile_number) {
      toast.error("No mobile number available for this student");
      return;
    }
    
    const template = settings?.whatsapp_default_template || "Hello {name}! Your exam code is: {code}";
    const message = template
      .replace("{code}", student.code || "")
      .replace("{name}", student.student_name || "");
    
    // Clean the mobile number (remove non-digits)
    const cleanNumber = student.mobile_number.replace(/\D/g, '');
    
    // Check if the number starts with a country code, if not add a default one
    const mobileNumber = cleanNumber.startsWith('+')
      ? cleanNumber
      : (cleanNumber.startsWith('0')
          ? cleanNumber.substring(1) // Remove leading zero if present
          : cleanNumber);
    
    const url = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast.success("WhatsApp message prepared");
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "students", "global"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/students");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.students as Student[]) ?? [];
    },
  });

  // Reset attempts for a student (removes links in student_exam_attempts)
  const resetAttempts = useMutation({
    mutationFn: async ({ id, examId }: { id: string; examId?: string }) => {
      if (!id || id === 'undefined') {
        throw new Error("Invalid student ID");
      }
      setActionError(null);
      const res = await authFetch(`/api/admin/students/${id}/reset-attempts`, {
        method: "POST",
        body: examId ? JSON.stringify({ examId }) : undefined,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Reset failed");
      return j as { deleted_count: number };
    },
    onSuccess: (result) => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
      toast.success(`Reset ${result.deleted_count || 0} attempt link(s)`);
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to reset attempts");
    },
  });

  const students = data ?? [];

  // Fetch app settings to get WhatsApp template
  const { data: settingsData } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async (): Promise<any | null> => {
      const res = await authFetch("/api/admin/settings");
      const result = await res.json();
      if (!res.ok) return null;
      return result.item || null;
    },
  });

  useEffect(() => {
    setSettings(settingsData);
  }, [settingsData]);

  // Clear action error when data changes
  useEffect(() => {
    setActionError(null);
  }, [students]);



  // Filters
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      [s.student_name, s.mobile_number, s.code]
        .map((v) => (v || "").toLowerCase())
        .some((v) => v.includes(term))
    );
  }, [students, q]);

  // Add single student
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newCode, setNewCode] = useState("");
  const addStudent = useMutation({
    mutationFn: async () => {
      setActionError(null);
      const payload = { 
        student_name: newName || null, 
        mobile_number: newMobile || null, 
        code: newCode || undefined 
      };
      const res = await authFetch("/api/admin/students", { 
        method: "POST", 
        body: JSON.stringify(payload) 
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Create failed");
      return j.student as Student;
    },
    onSuccess: () => {
      setNewName("");
      setNewMobile("");
      setNewCode("");
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to add student");
    },
  });

  // Row editing state
  const [edits, setEdits] = useState<Record<string, Partial<Student>>>({});
  function setEdit(id: string, patch: Partial<Student>) {
    setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));
  }

  const saveRow = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      if (!id || id === 'undefined') {
        throw new Error("Invalid student ID");
      }
      setActionError(null);
      const res = await authFetch(`/api/admin/students/${id}`, { 
        method: "PATCH", 
        body: JSON.stringify(payload) 
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update failed");
      return j.student as Student;
    },
    onSuccess: (_item, vars) => {
      setEdits((e) => ({ ...e, [vars.id]: {} }));
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to save student");
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      if (!id || id === 'undefined') {
        throw new Error("Invalid student ID");
      }
      setActionError(null);
      const res = await authFetch(`/api/admin/students/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      return true;
    },
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to delete student");
    },
  });

  // Clear all students
  const clearAll = useMutation({
    mutationFn: async () => {
      setActionError(null);
      const res = await authFetch("/api/admin/students/clear", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Clear failed");
      return j;
    },
    onSuccess: (result) => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
      alert(`Cleared ${result.deleted_count} students. Historical exam data preserved.`);
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to clear students");
    },
  });

  // Import
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);

  async function handleFile(file: File) {
    setImportErrors([]);
    setPreview([]);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".csv")) {
        const txt = await file.text();
        const rows = await parseCsv(txt);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const rows = await parseXlsx(buf);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else {
        setImportErrors(["Unsupported file type. Use CSV or XLSX."]);
      }
    } catch (e: any) {
      setImportErrors([e?.message || "Import failed"]);
    }
  }

  function mapRows(rows: any[][]) {
    // header: student_name,mobile_number,code (optional)
    const [header, ...dataRows] = rows;
    if (!header) throw new Error("Empty file");
    const idx = (name: string) => header.findIndex((h: string) => String(h).trim().toLowerCase() === name);
    const ni = idx("student_name");
    const mi = idx("mobile_number");
    const ci = idx("code");
    if (mi < 0) throw new Error("Missing header: mobile_number");
    const out = [] as any[];
    for (const r of dataRows) {
      const student_name = ni >= 0 ? String(r[ni] ?? "").trim() || null : null;
      const mobile_number = String(r[mi] ?? "").trim();
      if (!mobile_number) continue;
      const code = ci >= 0 ? String(r[ci] ?? "").trim() || undefined : undefined;
      out.push({ student_name, mobile_number, code });
    }
    return out;
  }

  async function commitImport() {
    if (!preview.length) return;
    const res = await authFetch("/api/admin/students/bulk", { 
      method: "POST", 
      body: JSON.stringify({ students: preview }) 
    });
    const j = await res.json();
    if (!res.ok) {
      setImportErrors([j?.error || "Bulk import failed"]);
      return;
    }
    setPreview([]);
    qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    alert(`Imported ${j.created_count} students`);
  }

  async function parseCsv(text: string): Promise<any[][]> {
    try {
      const Papa = (await import("papaparse")).default;
      const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
      return [res.data[0] as any, ...res.data.slice(1)];
    } catch {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(","));
      return rows;
    }
  }

  async function parseXlsx(buf: ArrayBuffer): Promise<any[][]> {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      return rows;
    } catch (e) {
      throw new Error("Install 'xlsx' to import Excel files");
    }
  }

  if (isLoading) return (
    <div className="p-8 text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading students...</p>
    </div>
  );
  
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-sm">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-800 font-semibold text-lg">Error loading students: {(error as any).message}</span>
        </div>
        <p className="text-red-700 mt-4 pl-9">
          Make sure you have run the database migration first. Check the RUN_MIGRATION_FIRST.md file for instructions.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <style jsx>{spinnerStyle}</style>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Global Students</h1>
        <div className="text-sm text-gray-600">
          Total: {students.length} students
        </div>
      </div>

      {/* Action Error Display */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800">{actionError}</span>
            </div>
            <button 
              onClick={() => setActionError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Search</label>
            <input 
              className="input" 
              placeholder="Search name, mobile or code" 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
            />
          </div>
          <div>
            <label className="label">Import CSV/XLSX (student_name, mobile_number, code)</label>
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls" 
              onChange={(e) => e.target.files && handleFile(e.target.files[0])} 
            />
          </div>
          <div className="flex items-end gap-2">
            {preview.length > 0 && (
              <button className="btn" onClick={commitImport}>
                Import {preview.length}
              </button>
            )}
            <button 
              className="btn btn-destructive" 
              onClick={() => {
                if (confirm("Clear ALL students? This will preserve historical exam data but remove all current students.")) {
                  clearAll.mutate();
                }
              }}
              disabled={clearAll.isPending}
            >
              {clearAll.isPending ? "Clearing..." : "Clear All"}
            </button>
          </div>
        </div>
        {importErrors.length > 0 && (
          <ul style={{ color: "var(--destructive)" }} className="text-sm list-disc pl-5">
            {importErrors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Add Student</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Name</label>
            <input 
              className="input" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
            />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input 
              className="input" 
              value={newMobile} 
              onChange={(e) => setNewMobile(e.target.value)} 
            />
          </div>
          <div>
            <label className="label">Code (optional)</label>
            <input 
              className="input" 
              value={newCode} 
              onChange={(e) => {
                // Allow only numeric input for 4-digit codes
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setNewCode(value);
              }}
              placeholder="1234"
              maxLength={4}
              inputMode="numeric"
            />
          </div>
          <div className="flex items-end">
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (!newMobile.trim()) {
                  setActionError("Mobile number is required");
                  return;
                }
                addStudent.mutate();
              }} 
              disabled={addStudent.isPending}
            >
              {addStudent.isPending ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-lg font-medium">No students found</p>
                    <p className="text-sm text-gray-400 mt-1">{q ? "Try a different search term" : "Add students to get started"}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const studentId = s.student_id;
                const e = edits[studentId] || {};
                return (
                  <tr key={studentId} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-mono font-medium">{s.code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input 
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        value={e.student_name ?? s.student_name ?? ""}
                        onChange={(ev) => setEdit(studentId, { student_name: ev.target.value })} 
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input 
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        value={e.mobile_number ?? s.mobile_number ?? ""}
                        onChange={(ev) => setEdit(studentId, { mobile_number: ev.target.value })} 
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium" title="Total attempted">{s.total_exams_attempted || 0}</span>
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-medium" title="Completed">{s.completed_exams || 0}</span>
                        <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium" title="In progress">{s.in_progress_exams || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(s.student_created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button 
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50" 
                          onClick={() => {
                            const payload = edits[studentId] || {};
                            if (Object.keys(payload).length > 0) {
                              saveRow.mutate({ id: studentId, payload });
                            }
                          }}
                          disabled={saveRow.isPending || !edits[studentId] || Object.keys(edits[studentId]).length === 0}
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {saveRow.isPending ? "Saving..." : "Save"}
                        </button>
                        <button 
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50" 
                          onClick={() => {
                            const total = s.total_exams_attempted || 0;
                            if (total === 0) return;
                            if (confirm(`Reset attempts for student ${s.code}? This removes per-exam attempt links so they can retake. Historical submissions remain.`)) {
                              resetAttempts.mutate({ id: studentId });
                            }
                          }}
                          disabled={resetAttempts.isPending || (s.total_exams_attempted || 0) === 0}
                          title={(s.total_exams_attempted || 0) === 0 ? "No attempts to reset" : "Allow student to retake by clearing attempt links"}
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9H4m0 0V4m0 5a8.003 8.003 0 0015.356 2H20" />
                          </svg>
                          {resetAttempts.isPending ? "Resetting..." : "Reset Attempts"}
                        </button>
                        <button 
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50" 
                          onClick={() => { 
                            if (confirm(`Delete student ${s.code}? Their exam history will be preserved.`)) {
                              deleteRow.mutate(studentId); 
                            }
                          }}
                          disabled={deleteRow.isPending}
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {deleteRow.isPending ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          onClick={() => sendWhatsApp(s)}
                          disabled={!s.mobile_number}
                          title={s.mobile_number ? "Send code via WhatsApp" : "No mobile number"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-1">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}