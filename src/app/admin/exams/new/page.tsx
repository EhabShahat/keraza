"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ActionButton from "@/components/admin/ActionButton";

export default function AdminNewExamPage() {
  const router = useRouter();
  const toast = useToast();
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    duration_minutes: 60,
    status: "draft",
    access_type: "open",
    settings: {
      attempt_limit: 1,
      ip_restriction: "",
      randomize_questions: false,
      display_mode: "full",
      auto_save_interval: 10,
      pass_percentage: 60,
    },
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);
      
      if (!form.title.trim()) {
        throw new Error("Title is required");
      }
      
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
        duration_minutes: Number(form.duration_minutes) || null,
        status: form.status,
        access_type: form.access_type,
        settings: form.settings,
      };
      
      const res = await authFetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create exam");
      
      toast.success({ 
        title: "Exam Created", 
        message: "Redirecting to exam editor..." 
      });
      
      router.replace(`/admin/exams/${data.item.id}/edit`);
    } catch (e: any) {
      setError(e?.message || "Save failed");
      toast.error({ 
        title: "Create Failed", 
        message: e?.message || "Unknown error" 
      });
    } finally {
      setSaving(false);
    }
  }

  function setSetting(key: string, value: any) {
    setForm((f) => ({ 
      ...f, 
      settings: { ...f.settings, [key]: value } 
    }));
  }

  function updateForm(updates: Partial<typeof form>) {
    setForm(f => ({ ...f, ...updates }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Exam</h1>
          <p className="text-gray-600 mt-1">Set up a new exam with questions and settings</p>
        </div>
        <ActionButton
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </ActionButton>
      </div>

      {/* Basic Information */}
      <ModernCard>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Basic Information</h2>
          <p className="text-gray-600 text-sm">Configure the exam title, description, and basic settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exam Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                !form.title.trim() ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g. Midterm Exam 2025"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
            />
            {!form.title.trim() && (
              <p className="text-red-600 text-xs mt-1">Title is required</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Optional instructions for students..."
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
            />
            <p className="text-gray-500 text-xs mt-1">
              Optional. You can include instructions or important notes for students.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.status}
              onChange={(e) => updateForm({ status: e.target.value })}
            >
              <option value="draft">Draft - Not visible to students</option>
              <option value="published">Published - Available to students</option>
              <option value="archived">Archived - No longer available</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.access_type}
              onChange={(e) => updateForm({ access_type: e.target.value })}
            >
              <option value="open">Open - Anyone can access</option>
              <option value="code_based">Code Based - Requires exam code</option>
              <option value="ip_restricted">IP Restricted - Limited by IP address</option>
            </select>
          </div>
        </div>
      </ModernCard>

      {/* Timing Settings */}
      <ModernCard>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Timing & Schedule</h2>
          <p className="text-gray-600 text-sm">Configure when the exam is available and how long students have</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.start_time}
              onChange={(e) => updateForm({ start_time: e.target.value })}
            />
            <p className="text-gray-500 text-xs mt-1">
              When students can start taking the exam
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.end_time}
              onChange={(e) => updateForm({ end_time: e.target.value })}
            />
            <p className="text-gray-500 text-xs mt-1">
              When the exam closes for all students
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="600"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.duration_minutes}
              onChange={(e) => updateForm({ duration_minutes: Number(e.target.value) })}
            />
            <p className="text-gray-500 text-xs mt-1">
              How long each student has to complete the exam
            </p>
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
              max="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.settings.attempt_limit}
              onChange={(e) => setSetting("attempt_limit", Number(e.target.value))}
            />
            <p className="text-gray-500 text-xs mt-1">
              How many times a student can attempt the exam
            </p>
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
                value={form.settings.pass_percentage ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSetting("pass_percentage", val === "" ? null : Math.max(0, Math.min(100, Number(val))));
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Minimum percentage required to pass. Leave empty to disable.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-save Interval (seconds)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.settings.auto_save_interval}
              onChange={(e) => setSetting("auto_save_interval", Number(e.target.value))}
            />
            <p className="text-gray-500 text-xs mt-1">
              How often to automatically save student progress
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Mode
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.settings.display_mode}
              onChange={(e) => setSetting("display_mode", e.target.value)}
            >
              <option value="full">Full Exam - Show all questions at once</option>
              <option value="per_question">Per Question - Show one question at a time</option>
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
              value={form.settings.ip_restriction}
              onChange={(e) => setSetting("ip_restriction", e.target.value)}
            />
            <p className="text-gray-500 text-xs mt-1">
              Comma-separated list of IP addresses or CIDR ranges. Leave empty to allow all IPs.
            </p>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="randomize"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.settings.randomize_questions}
                onChange={(e) => setSetting("randomize_questions", e.target.checked)}
              />
              <label htmlFor="randomize" className="text-sm font-medium text-gray-700">
                Randomize Questions and Options
              </label>
            </div>
            <p className="text-gray-500 text-xs mt-1 ml-6">
              Shuffle the order of questions and multiple choice options for each student
            </p>
          </div>
        </div>
      </ModernCard>

      {/* Error Display */}
      {error && (
        <ModernCard className="border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-red-800">Error Creating Exam</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </ModernCard>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t">
        <ActionButton
          variant="secondary"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={onSave}
          loading={saving}
          disabled={!form.title.trim()}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          }
        >
          Create Exam
        </ActionButton>
      </div>
    </div>
  );
}