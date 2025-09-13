"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";

export default function AdminEditExamPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { examId } = useParams<{ examId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "exam", examId],
    enabled: !!examId,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Load failed");
      return result.item as any;
    },
  });

  const [localChanges, setLocalChanges] = useState<any>(null);
  const exam = localChanges ?? data;

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/publish`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Publish failed");
      return result.item;
    },
    onSuccess: (item) => {
      setLocalChanges(item);
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Published", message: "Students can now access this exam" });
    },
    onError: (error: any) => {
      toast.error({ title: "Publish Failed", message: error.message || "Unknown error" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/archive`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Archive failed");
      return result.item;
    },
    onSuccess: (item) => {
      setLocalChanges(item);
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Archived", message: "Exam is no longer available to students" });
    },
    onError: (error: any) => {
      toast.error({ title: "Archive Failed", message: error.message || "Unknown error" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exam),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Save failed");
      return result.item;
    },
    onSuccess: (item) => {
      setLocalChanges(item);
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Changes Saved", message: "Exam has been updated successfully" });
    },
    onError: (error: any) => {
      toast.error({ title: "Save Failed", message: error.message || "Unknown error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Delete failed");
      }
      return true;
    },
    onSuccess: () => {
      toast.success({ title: "Exam Deleted", message: "Returning to exam list" });
      router.replace("/admin/exams");
    },
    onError: (error: any) => {
      toast.error({ title: "Delete Failed", message: error.message || "Unknown error" });
    },
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${exam?.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const updateExam = (updates: any) => {
    setLocalChanges({ ...(exam || data), ...updates });
  };

  const updateSetting = (key: string, value: any) => {
    setLocalChanges({
      ...(exam || data),
      settings: { ...((exam || data)?.settings || {}), [key]: value }
    });
  };

  if (!examId || isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48"></div>
        <div className="skeleton h-64 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Exam</h1>
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading exam</p>
            <p className="text-sm mt-1">{(error as any).message}</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Exam</h1>
        <ModernCard>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">❓</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Exam Not Found</h3>
            <p className="text-gray-600">The exam you're looking for doesn't exist or has been deleted.</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Edit Exam</h1>
            <StatusBadge status={exam.status} />
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {exam.access_type}
            </span>
          </div>
          <p className="text-gray-600">Configure exam settings and manage content</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin/exams">
            <ActionButton variant="secondary" size="sm">
              ← Back to Exams
            </ActionButton>
          </Link>
          <Link href={`/admin/exams/${examId}/questions`}>
            <ActionButton variant="secondary" size="sm">Questions</ActionButton>
          </Link>
          <Link href={`/admin/exams/${examId}/students-codes`}>
            <ActionButton variant="secondary" size="sm">Students</ActionButton>
          </Link>

          
          {exam.status === "draft" && (
            <ActionButton
              variant="success"
              size="sm"
              onClick={() => publishMutation.mutate()}
              loading={publishMutation.isPending}
            >
              Publish
            </ActionButton>
          )}
          
          {exam.status === "published" && (
            <ActionButton
              variant="warning"
              size="sm"
              onClick={() => archiveMutation.mutate()}
              loading={archiveMutation.isPending}
            >
              Archive
            </ActionButton>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <ModernCard>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Basic Information</h2>
          <p className="text-gray-600 text-sm">Update the exam title, description, and basic settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exam Title
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.title || ""}
              onChange={(e) => updateExam({ title: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              value={exam.description || ""}
              onChange={(e) => updateExam({ description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.status}
              onChange={(e) => updateExam({ status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.access_type}
              onChange={(e) => updateExam({ access_type: e.target.value })}
            >
              <option value="open">Open</option>
              <option value="code_based">Code Based</option>
              <option value="ip_restricted">IP Restricted</option>
            </select>
          </div>
        </div>
      </ModernCard>

      {/* Timing Settings */}
      <ModernCard>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Timing & Schedule</h2>
          <p className="text-gray-600 text-sm">Configure when the exam is available and duration limits</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={toInputDate(exam.start_time)}
              onChange={(e) => updateExam({ start_time: fromInputDate(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={toInputDate(exam.end_time)}
              onChange={(e) => updateExam({ end_time: fromInputDate(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.duration_minutes || ""}
              onChange={(e) => updateExam({ duration_minutes: Number(e.target.value) || null })}
            />
          </div>
        </div>
      </ModernCard>

      {/* Advanced Settings */}
      <ModernCard>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Advanced Settings</h2>
          <p className="text-gray-600 text-sm">Configure exam behavior and restrictions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attempt Limit
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.settings?.attempt_limit || 1}
              onChange={(e) => updateSetting("attempt_limit", Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pass Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                value={exam.settings?.pass_percentage ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const parsed = val === "" ? null : Math.max(0, Math.min(100, Number(val)));
                  updateSetting("pass_percentage", parsed);
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">Minimum percentage required to pass. Leave empty to disable.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-save Interval (seconds)
            </label>
            <input
              type="number"
              min="5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.settings?.auto_save_interval || 10}
              onChange={(e) => updateSetting("auto_save_interval", Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Mode
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={exam.settings?.display_mode || "full"}
              onChange={(e) => updateSetting("display_mode", e.target.value)}
            >
              <option value="full">Full Exam</option>
              <option value="per_question">Per Question</option>
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IP Restrictions
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 10.0.0.0/8, 192.168.1.0/24"
              value={exam.settings?.ip_restriction || ""}
              onChange={(e) => updateSetting("ip_restriction", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="randomize-edit"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={exam.settings?.randomize_questions || false}
                onChange={(e) => updateSetting("randomize_questions", e.target.checked)}
              />
              <label htmlFor="randomize-edit" className="text-sm font-medium text-gray-700">
                Randomize Questions and Options
              </label>
            </div>
          </div>
        </div>
      </ModernCard>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <ActionButton
          variant="danger"
          onClick={handleDelete}
          loading={deleteMutation.isPending}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
        >
          Delete Exam
        </ActionButton>

        <ActionButton
          variant="primary"
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        >
          Save Changes
        </ActionButton>
      </div>
    </div>
  );
}

function toInputDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputDate(s: string) {
  if (!s) return null;
  return new Date(s).toISOString();
}