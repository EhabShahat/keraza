"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";

interface Exam {
  id: string;
  title: string;
  status: string;
  access_type: string;
}

interface Attempt {
  id: string;
  student_name: string | null;
  completion_status: string | null;
  started_at: string | null;
  submitted_at: string | null;
  score_percentage: number | null;
  ip_address: string | null;
}

export default function AdminResultsIndex() {
  const [examId, setExamId] = useState<string>("");
  const [studentFilter, setStudentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [scoreSort, setScoreSort] = useState<"none" | "asc" | "desc">("none");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const toast = useToast();

  const examsQuery = useQuery({
    queryKey: ["admin", "exams", "all"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load exams failed");
      return (j.items as Exam[])?.sort((a, b) => a.title.localeCompare(b.title));
    },
  });

  const attemptsQuery = useQuery({
    enabled: !!examId,
    queryKey: ["admin", "attempts", examId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/attempts`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load attempts failed");
      return j.items as Attempt[];
    },
  });

  // Auto-select the last published exam (there is at most one published exam by DB constraint)
  useEffect(() => {
    if (!examId && examsQuery.data?.length) {
      const published = examsQuery.data.find((e) => e.status === "published");
      if (published) setExamId(published.id);
    }
  }, [examId, examsQuery.data]);

  const selectedExam = useMemo(() => 
    examsQuery.data?.find((e) => e.id === examId) ?? null, 
    [examsQuery.data, examId]
  );

  const filteredAttempts = useMemo(() => {
    const rows = attemptsQuery.data ?? [];
    return rows.filter((attempt) => {
      if (studentFilter && !String(attempt.student_name || "").toLowerCase().includes(studentFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter && String(attempt.completion_status || "") !== statusFilter) {
        return false;
      }
      if (startDate && attempt.started_at) {
        const startDateTime = new Date(startDate);
        const attemptStart = new Date(attempt.started_at);
        if (attemptStart < startDateTime) return false;
      }
      if (endDate && attempt.started_at) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // Include full end date
        const attemptStart = new Date(attempt.started_at);
        if (attemptStart > endDateTime) return false;
      }
      return true;
    });
  }, [attemptsQuery.data, studentFilter, statusFilter, startDate, endDate]);

  const sortedAttempts = useMemo(() => {
    const rows = filteredAttempts.slice();
    if (scoreSort === "none") return rows;
    if (scoreSort === "asc") {
      rows.sort((a, b) => {
        const av = a.score_percentage;
        const bv = b.score_percentage;
        if (av === null && bv === null) return 0;
        if (av === null) return 1; // nulls last
        if (bv === null) return -1;
        return (av as number) - (bv as number);
      });
    } else if (scoreSort === "desc") {
      rows.sort((a, b) => {
        const av = a.score_percentage;
        const bv = b.score_percentage;
        if (av === null && bv === null) return 0;
        if (av === null) return 1; // nulls last
        if (bv === null) return -1;
        return (bv as number) - (av as number);
      });
    }
    return rows;
  }, [filteredAttempts, scoreSort]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await authFetch(`/api/admin/exams/${examId}/attempts/export`);
      const blob = await res.blob();
      if (!res.ok) {
        const txt = await blob.text();
        throw new Error(txt || "Export failed");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attempts_${examId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success({ title: "Export Complete", message: "CSV file downloaded successfully" });
    } catch (e: any) {
      toast.error({ title: "Export Failed", message: e?.message || "Unknown error" });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      const XLSX = await import("xlsx");
      const rows = filteredAttempts.map((attempt) => ({
        id: attempt.id,
        student: attempt.student_name ?? "",
        status: attempt.completion_status ?? "",
        started_at: attempt.started_at ?? "",
        submitted_at: attempt.submitted_at ?? "",
        score_percentage: attempt.score_percentage ?? "",
        ip_address: attempt.ip_address ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attempts");
      XLSX.writeFile(wb, `attempts_${examId}.xlsx`);
      toast.success({ title: "Export Complete", message: "XLSX file saved successfully" });
    } catch (e: any) {
      toast.error({ title: "Export Failed", message: e?.message || "Unknown error" });
    } finally {
      setExportingXlsx(false);
    }
  };

  const deleteAttempt = async (attemptId: string) => {
    try {
      setDeleting(attemptId);
      const response = await authFetch(`/api/admin/attempts/${attemptId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete attempt');
      }
      
      // Refresh the data
      attemptsQuery.refetch();
      setDeleteConfirm(null);
      toast.success({ title: "Success", message: "Attempt deleted successfully" });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error({ 
        title: "Delete Failed", 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setDeleting(null);
    }
  };

  const clearFilters = () => {
    setStudentFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
  };

  const columns = [
    { key: "attempt", label: "Attempt ID", width: "150px" },
    { key: "student", label: "Student" },
    { key: "status", label: "Status", width: "120px" },
    { key: "started", label: "Started", width: "150px" },
    { key: "submitted", label: "Submitted", width: "150px" },
    { key: "score", label: "Score", width: "100px", align: "center" as const },
    { key: "ip", label: "IP Address", width: "130px" },
    { key: "actions", label: "Actions", width: "100px" },
  ];

  const renderCell = (attempt: Attempt, column: any) => {
    switch (column.key) {
      case "attempt":
        return (
          <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
            {attempt.id.slice(0, 8)}...
          </code>
        );
      case "student":
        return attempt.student_name || <span className="text-gray-400">Anonymous</span>;
      case "status":
        const status = (attempt.completion_status ?? "in_progress") as "in_progress" | "submitted" | "abandoned" | "invalid";
        return (
          <StatusBadge 
            status={status}
            size="sm" 
          />
        );
      case "started":
        return attempt.started_at ? new Date(attempt.started_at).toLocaleString() : "-";
      case "submitted":
        return attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "-";
      case "score":
        return attempt.score_percentage !== null ? (
          <span className={`font-bold ${
            attempt.score_percentage >= 80 ? 'text-green-600' :
            attempt.score_percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {attempt.score_percentage}%
          </span>
        ) : "-";
      case "ip":
        return (
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {attempt.ip_address || "Unknown"}
          </code>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Link href={`/admin/results/${attempt.id}`}>
              <ActionButton variant="secondary" size="sm">View</ActionButton>
            </Link>
            <ActionButton 
              variant="danger" 
              size="sm"
              onClick={() => setDeleteConfirm(attempt.id)}
            >
              Delete
            </ActionButton>
          </div>
        );
      default:
        return null;
    }
  };

  const statusOptions = Array.from(
    new Set((attemptsQuery.data ?? []).map((a) => String(a.completion_status || "")))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Results</h1>
          <p className="text-gray-600 mt-1">View and analyze student exam attempts</p>
        </div>
      </div>

      {/* Exam Selection */
      }
      <ModernCard>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exams
            </label>
            <div className="flex flex-wrap gap-2">
              {(examsQuery.data ?? []).map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => setExamId(exam.id)}
                  className={`px-3 py-2 rounded-lg border text-sm transition ${
                    examId === exam.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{exam.title}</span>
                  {exam.status === 'published' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                      Published
                    </span>
                  )}
                </button>
              ))}
              {(!examsQuery.isLoading && (examsQuery.data ?? []).length === 0) && (
                <span className="text-sm text-gray-500">No exams found</span>
              )}
            </div>
          </div>
          
          {selectedExam && (
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedExam.status as any} size="sm" />
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {selectedExam.access_type}
              </span>
            </div>
          )}
        </div>

        {examId && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <Link href={`/admin/results/analysis/${examId}`}>
              <ActionButton
                variant="secondary"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                View Analysis
              </ActionButton>
            </Link>
            <ActionButton
              variant="secondary"
              onClick={handleExportCsv}
              loading={exportingCsv}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export CSV
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportXlsx}
              loading={exportingXlsx}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export Excel
            </ActionButton>
          </div>
        )}
      </ModernCard>

      {/* Filters */}
      {examId && (
        <ModernCard>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Name
              </label>
              <SearchInput
                placeholder="Filter by student name"
                value={studentFilter}
                onChange={setStudentFilter}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Any status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status || "Incomplete"}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort by Score
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={scoreSort}
                onChange={(e) => setScoreSort(e.target.value as any)}
              >
                <option value="none">None</option>
                <option value="desc">Highest first</option>
                <option value="asc">Lowest first</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <ActionButton
                variant="secondary"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </ActionButton>
            </div>
          </div>
          
          {(studentFilter || statusFilter || startDate || endDate) && (
            <div className="mt-4 pt-4 border-t text-sm text-gray-600">
              Showing {filteredAttempts.length} of {attemptsQuery.data?.length || 0} attempts
            </div>
          )}
        </ModernCard>
      )}

      {/* Results Table */}
      {!examId && (
        <ModernCard>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Exam</h3>
            <p className="text-gray-600">Choose an exam from the buttons above to view student results</p>
          </div>
        </ModernCard>
      )}

      {examId && (
        <ModernTable
          columns={columns}
          data={sortedAttempts}
          renderCell={renderCell}
          loading={attemptsQuery.isLoading}
          emptyMessage={
            attemptsQuery.data?.length === 0
              ? "No attempts found for this exam"
              : "No attempts match your current filters"
          }
        />
      )}

      {examId && attemptsQuery.error && (
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading attempts</p>
            <p className="text-sm mt-1">{(attemptsQuery.error as any).message}</p>
          </div>
        </ModernCard>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Attempt
                </h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this attempt? This action cannot be undone and will permanently remove all associated data including answers and scores.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <ActionButton
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting === deleteConfirm}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={() => deleteAttempt(deleteConfirm)}
                loading={deleting === deleteConfirm}
              >
                Delete Attempt
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}