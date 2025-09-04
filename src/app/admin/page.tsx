"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import StatsCard from "@/components/admin/StatsCard";
import ModernCard from "@/components/admin/ModernCard";
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

export default function AdminHomePage() {
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableMessage, setDisableMessage] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/dashboard");
      return res.json() as Promise<{ 
        exams: Exam[];
        activeExam: Exam | null;
        stats: {
          totalExams: number;
          activeAttempts: number;
          completedToday: number;
        };
        systemStatus: {
          isDisabled: boolean;
          disableMessage: string;
          mode?: 'exam' | 'results' | 'disabled';
        };
      }>;
    },
  });

  const disableSystemMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const res = await authFetch("/api/admin/system/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "disabled", message }),
      });
      if (!res.ok) throw new Error("Failed to set Disabled mode");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success({ title: "Mode set to Disabled", message: "Public access is blocked with your message" });
      setShowDisableModal(false);
      setDisableMessage("");
    },
    onError: (error: any) => {
      toast.error({ title: "Failed to set Disabled mode", message: error.message });
    },
  });

  const enableSystemMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/admin/system/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "exam" }),
      });
      if (!res.ok) throw new Error("Failed to switch to Exam mode");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success({ title: "Exam mode", message: "Students can access published exams" });
    },
    onError: (error: any) => {
      toast.error({ title: "Failed to switch to Exam mode", message: error.message });
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/publish`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to publish exam");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success({ title: "Exam published", message: "Students can now access this exam" });
    },
    onError: (error: any) => {
      toast.error({ title: "Failed to publish exam", message: error.message });
    },
  });

  const archiveExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/archive`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to archive exam");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success({ title: "Exam archived", message: "Exam is no longer available to students" });
    },
    onError: (error: any) => {
      toast.error({ title: "Failed to archive exam", message: error.message });
    },
  });

  const resultsModeMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/admin/system/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "results" }),
      });
      if (!res.ok) throw new Error("Failed to switch to Results mode");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success({ title: "Results mode", message: "Public will be redirected to results" });
    },
    onError: (error: any) => {
      toast.error({ title: "Failed to switch to Results mode", message: error.message });
    },
  });

  const exams = data?.exams ?? [];
  const activeExam = data?.activeExam;
  const stats = data?.stats;
  const systemStatus = data?.systemStatus;
  const systemMode: 'exam' | 'results' | 'disabled' = (systemStatus?.mode as any) ?? (systemStatus?.isDisabled ? 'disabled' : 'exam');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-20 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="skeleton h-32 rounded-lg"></div>
          <div className="skeleton h-32 rounded-lg"></div>
          <div className="skeleton h-32 rounded-lg"></div>
          <div className="skeleton h-32 rounded-lg"></div>
        </div>
        <div className="skeleton h-64 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <ModernCard>
        <div className="text-center text-red-600">
          <h2 className="font-semibold mb-2">Error loading dashboard</h2>
          <p>{(error as any).message}</p>
        </div>
      </ModernCard>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <span className="bg-blue-600 text-white p-2 rounded-lg shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-2 ml-9">
            Manage exams, monitor activity, and control system access
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/monitoring" className="btn btn-secondary btn-sm hover:scale-105 transition-transform">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Live Monitor
          </Link>
          <Link href="/admin/exams/new">
            <ActionButton
              variant="primary"
              className="hover:scale-105 transition-transform shadow-md"
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

      {/* System Status Alert */}
      <ModernCard className={`border-l-4 ${systemMode === 'disabled' ? 'border-l-red-500 bg-red-50' : systemMode === 'results' ? 'border-l-blue-500 bg-blue-50' : 'border-l-green-500 bg-green-50'} shadow-md transition-all duration-300 transform hover:scale-[1.01]`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${systemMode === 'disabled' ? 'bg-red-100' : systemMode === 'results' ? 'bg-blue-100' : 'bg-green-100'}`}>
                {systemMode === 'disabled' ? (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : systemMode === 'results' ? (
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${systemMode === 'disabled' ? 'bg-red-500' : systemMode === 'results' ? 'bg-blue-500' : 'bg-green-500'} animate-pulse border-2 border-white`}></div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">System Status</h3>
              <p className="text-sm text-gray-600 mt-1">
                {systemMode === 'disabled' 
                  ? `Disabled: ${systemStatus?.disableMessage || 'No exams available to students'}` 
                  : systemMode === 'results' 
                    ? 'Results Mode - Public sees the results page'
                    : 'Exam Mode - Students can access published exams'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              variant="success"
              size="sm"
              onClick={() => enableSystemMutation.mutate()}
              loading={enableSystemMutation.isPending}
              disabled={systemMode === 'exam'}
              className="shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            >
              Exam Mode
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => resultsModeMutation.mutate()}
              loading={resultsModeMutation.isPending}
              disabled={systemMode === 'results'}
              className="shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
              }
            >
              Results Mode
            </ActionButton>
            <ActionButton
              variant="danger"
              size="sm"
              onClick={() => setShowDisableModal(true)}
              disabled={systemMode === 'disabled'}
              className="shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              }
            >
              Disable System
            </ActionButton>
          </div>
        </div>
      </ModernCard>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Exams" 
          value={stats?.totalExams ?? 0} 
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          href="/admin/exams"
          color="blue"
        />
        <StatsCard 
          title="Active Attempts" 
          value={stats?.activeAttempts ?? 0} 
          icon={
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          href="/admin/monitoring"
          color="orange"
        />
        <StatsCard 
          title="Completed Today" 
          value={stats?.completedToday ?? 0} 
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          href="/admin/results"
          color="green"
        />
        <StatsCard 
          title="System Health" 
          value={systemMode === 'disabled' ? 'Disabled' : systemMode === 'results' ? 'Results Mode' : 'Active'} 
          icon={
            systemMode === 'disabled' ? (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : systemMode === 'results' ? (
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )
          }
          href="/admin/settings"
          color={systemMode === 'disabled' ? 'red' : systemMode === 'results' ? 'blue' : 'green'}
        />
      </div>
      
      {/* Active Exam Section */}
      <ModernCard className="shadow-md hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Currently Active Exam
          </h2>
          {activeExam && (
            <ActionButton
              variant="danger"
              size="sm"
              onClick={() => archiveExamMutation.mutate(activeExam.id)}
              loading={archiveExamMutation.isPending}
              className="hover:scale-105 transition-transform shadow-sm"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4" />
                </svg>
              }
            >
              Archive Exam
            </ActionButton>
          )}
        </div>
        
        {activeExam ? (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-inner transform transition-all duration-300 hover:scale-[1.01]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <StatusBadge status="published" />
                  <h3 className="text-lg font-semibold text-green-900">{activeExam.title}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-700">
                  <div className="flex items-center gap-2 bg-white/50 p-2 rounded-lg shadow-sm">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{activeExam.question_count || 0} questions</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/50 p-2 rounded-lg shadow-sm">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{activeExam.attempt_count || 0} attempts</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/50 p-2 rounded-lg shadow-sm">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span>{activeExam.access_type}</span>
                  </div>
                </div>
                {activeExam.start_time && (
                  <p className="text-xs text-green-600 mt-2 bg-white/50 inline-block px-2 py-1 rounded-md">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Started: {new Date(activeExam.start_time).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/admin/exams/${activeExam.id}/edit`}>
                  <ActionButton 
                    variant="secondary" 
                    size="sm"
                    className="hover:scale-105 transition-transform shadow-sm"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    }
                  >
                    Edit
                  </ActionButton>
                </Link>
                <Link href={`/admin/exams/${activeExam.id}/questions`}>
                  <ActionButton 
                    variant="secondary" 
                    size="sm"
                    className="hover:scale-105 transition-transform shadow-sm"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  >
                    Questions
                  </ActionButton>
                </Link>
                <Link href="/admin/students">
                  <ActionButton 
                    variant="primary" 
                    size="sm"
                    className="hover:scale-105 transition-transform shadow-sm"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    }
                  >
                    Students
                  </ActionButton>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center transform transition-all duration-300 hover:scale-[1.01] hover:bg-gray-100/50">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Exam</h3>
            <p className="text-gray-600 mb-4">Students will see a "no exams available" message</p>
            <Link href="/admin/exams">
              <ActionButton 
                variant="primary" 
                size="sm"
                className="hover:scale-105 transition-transform shadow-md"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                }
              >
                Browse Exams
              </ActionButton>
            </Link>
          </div>
        )}
      </ModernCard>

      {/* Recent Exams */}
      <ModernCard className="shadow-md hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Recent Exams
          </h2>
          <Link 
            href="/admin/exams" 
            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all duration-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg"
          >
            View all exams
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
        
        {exams.length > 0 ? (
          <div className="space-y-4">
            {exams.slice(0, 5).map((exam) => (
              <ExamRow 
                key={exam.id} 
                exam={exam} 
                onPublish={() => publishExamMutation.mutate(exam.id)}
                onArchive={() => archiveExamMutation.mutate(exam.id)}
                isPublishing={publishExamMutation.isPending}
                isArchiving={archiveExamMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 transform transition-all duration-300 hover:scale-[1.01] hover:bg-gray-100/50">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No exams created yet</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first exam</p>
            <Link href="/admin/exams/new">
              <ActionButton 
                variant="primary"
                className="hover:scale-105 transition-transform shadow-md"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                }
              >
                Create First Exam
              </ActionButton>
            </Link>
          </div>
        )}
      </ModernCard>

      {/* Disable System Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-backdrop">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 modal-content shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Disable System Access</h3>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm">
                This will prevent students from accessing any exams. You can provide a custom message to display.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message to display to students
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  rows={3}
                  placeholder="No exams are currently available. Please check back later."
                  value={disableMessage}
                  onChange={(e) => setDisableMessage(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 justify-end pt-2">
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    setShowDisableModal(false);
                    setDisableMessage("");
                  }}
                  className="hover:scale-105 transition-transform shadow-sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  }
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  variant="danger"
                  onClick={() => disableSystemMutation.mutate({ 
                    message: disableMessage || "No exams are currently available. Please check back later." 
                  })}
                  loading={disableSystemMutation.isPending}
                  className="hover:scale-105 transition-transform shadow-sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  }
                >
                  Disable System
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamRow({ 
  exam, 
  onPublish, 
  onArchive, 
  isPublishing, 
  isArchiving 
}: { 
  exam: Exam; 
  onPublish: () => void;
  onArchive: () => void;
  isPublishing: boolean;
  isArchiving: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-200 hover:shadow-md transition-all duration-300 exam-row">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 rounded-lg p-2 text-blue-600 hidden sm:block">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={exam.status} size="sm" />
            <h4 className="font-medium text-gray-900">{exam.title}</h4>
          </div>
          <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600 mt-1">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {exam.question_count || 0} questions
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {exam.access_type}
            </span>
            {exam.created_at && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Created {new Date(exam.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {exam.status === 'draft' && (
          <ActionButton
            variant="success"
            size="sm"
            onClick={onPublish}
            loading={isPublishing}
            className="shadow-sm hover:shadow transition-all duration-200 hover:scale-105"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            Publish
          </ActionButton>
        )}
        {exam.status === 'published' && (
          <ActionButton
            variant="warning"
            size="sm"
            onClick={onArchive}
            loading={isArchiving}
            className="shadow-sm hover:shadow transition-all duration-200 hover:scale-105"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            }
          >
            Archive
          </ActionButton>
        )}
        <Link href={`/admin/exams/${exam.id}/edit`}>
          <ActionButton 
            variant="secondary" 
            size="sm"
            className="shadow-sm hover:shadow transition-all duration-200 hover:scale-105"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
          >
            Edit
          </ActionButton>
        </Link>
      </div>
    </div>
  );
}
