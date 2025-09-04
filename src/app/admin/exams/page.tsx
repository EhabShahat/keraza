"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";

interface Exam {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  access_type: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  question_count?: number;
  attempt_count?: number;
}

export default function AdminExamsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "exams", searchQuery],
    queryFn: async () => {
      const url = searchQuery ? `/api/admin/exams?q=${encodeURIComponent(searchQuery)}` : "/api/admin/exams";
      const res = await authFetch(url);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load exams");
      return result as { items: Exam[] };
    },
  });

  const exams = data?.items ?? [];

  // Duplicate exam mutation
  const duplicateMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/duplicate`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Duplicate failed");
      return result;
    },
    onSuccess: (result) => {
      const newId = result?.item?.id;
      if (newId) {
        toast.success({ title: "Exam Duplicated", message: "Opening editor..." });
        router.push(`/admin/exams/${newId}/edit`);
      }
    },
    onError: (error: any) => {
      toast.error({ title: "Duplicate Failed", message: error.message });
    },
  });

  // Delete exam mutation
  const deleteMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Delete failed");
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Deleted", message: "Exam has been permanently deleted" });
    },
    onError: (error: any) => {
      toast.error({ title: "Delete Failed", message: error.message });
    },
  });

  const columns = [
    { key: "title", label: "Exam Title" },
    { key: "status", label: "Status", width: "120px" },
    { key: "access_type", label: "Access Type", width: "120px" },
    { key: "questions", label: "Questions", width: "100px", align: "center" as const },
    { key: "attempts", label: "Attempts", width: "100px", align: "center" as const },
    { key: "created", label: "Created", width: "150px" },
    { key: "actions", label: "Actions", width: "200px" },
  ];

  const renderCell = (exam: Exam, column: any) => {
    switch (column.key) {
      case "title":
        return (
          <div>
            <div className="font-medium text-gray-900">{exam.title}</div>
            <div className="text-sm text-gray-500">ID: {exam.id.slice(0, 8)}...</div>
          </div>
        );
      case "status":
        return <StatusBadge status={exam.status} size="sm" />;
      case "access_type":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {exam.access_type}
          </span>
        );
      case "questions":
        return <span className="font-medium">{exam.question_count || 0}</span>;
      case "attempts":
        return <span className="font-medium">{exam.attempt_count || 0}</span>;
      case "created":
        return exam.created_at ? new Date(exam.created_at).toLocaleDateString() : "-";
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Link href={`/admin/exams/${exam.id}/edit`}>
              <ActionButton variant="secondary" size="sm">Edit</ActionButton>
            </Link>
            <Link href={`/admin/exams/${exam.id}/questions`}>
              <ActionButton variant="secondary" size="sm">Questions</ActionButton>
            </Link>
            <Link href={`/admin/exams/${exam.id}/students-codes`}>
              <ActionButton variant="secondary" size="sm">Students</ActionButton>
            </Link>

            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => duplicateMutation.mutate(exam.id)}
              loading={duplicateMutation.isPending}
            >
              Duplicate
            </ActionButton>
            <ActionButton
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${exam.title}"? This action cannot be undone.`)) {
                  deleteMutation.mutate(exam.id);
                }
              }}
              loading={deleteMutation.isPending}
            >
              Delete
            </ActionButton>
          </div>
        );
      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
        </div>
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading exams</p>
            <p className="text-sm mt-1">{(error as any).message}</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
          <p className="text-gray-600 mt-1">Create, edit, and manage your exams</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/exams/new">
            <ActionButton
              variant="primary"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
            >
              Create New Exam
            </ActionButton>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <ModernCard>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <SearchInput
            placeholder="Search exams by title..."
            value={searchQuery}
            onChange={setSearchQuery}
            loading={isLoading}
            className="lg:w-96"
          />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Total: {exams.length} exams</span>
            <span>•</span>
            <span>Published: {exams.filter(e => e.status === 'published').length}</span>
            <span>•</span>
            <span>Draft: {exams.filter(e => e.status === 'draft').length}</span>
          </div>
        </div>
      </ModernCard>

      {/* Exams Table */}
      <ModernTable
        columns={columns}
        data={exams}
        renderCell={renderCell}
        loading={isLoading}
        emptyMessage={
          searchQuery 
            ? `No exams found matching "${searchQuery}"` 
            : "No exams created yet. Create your first exam to get started."
        }
      />
    </div>
  );
}