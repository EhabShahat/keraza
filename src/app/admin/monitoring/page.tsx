"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import StatsCard from "@/components/admin/StatsCard";
import StatusBadge from "@/components/admin/StatusBadge";
import ActionButton from "@/components/admin/ActionButton";

interface RunningByExam { 
  exam_id: string; 
  exam_title: string; 
  count: number;
}

interface ActiveItem { 
  id: string; 
  exam_id: string; 
  exam_title: string; 
  student_name: string | null; 
  ip_address: string | null; 
  started_at: string;
}

interface RecentItem extends ActiveItem { 
  submitted_at: string; 
  completion_status: string | null;
}

export default function AdminMonitoringPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "monitoring"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/monitoring`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return j as {
        now: string;
        active_count: number;
        submissions_last_60m: number;
        running_by_exam: RunningByExam[];
        active_list: ActiveItem[];
        recent_list: RecentItem[];
      };
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Live Monitoring</h1>
        </div>
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading monitoring data</p>
            <p className="text-sm mt-1">{(error as any).message}</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time exam activity and system health</p>
        </div>
        <div className="flex items-center gap-4">
          <ActionButton
            variant="warning"
            onClick={async () => {
              try {
                const res = await authFetch("/api/admin/cleanup-expired", { method: "POST" });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error);
                
                // Refresh the data after cleanup
                queryClient.invalidateQueries({ queryKey: ["admin", "monitoring"] });
                
                if (result.auto_submitted_count > 0) {
                  toast.success({ 
                    title: "Cleanup Complete", 
                    message: `Auto-submitted ${result.auto_submitted_count} expired attempts` 
                  });
                } else {
                  toast.success({ 
                    title: "Cleanup Complete", 
                    message: "No expired attempts found" 
                  });
                }
              } catch (error: any) {
                toast.error({ 
                  title: "Cleanup Failed", 
                  message: error.message || "Unknown error" 
                });
              }
            }}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
          >
            Cleanup Expired
          </ActionButton>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>
              {isLoading ? "Updating..." : `Last updated: ${d ? new Date(d.now).toLocaleTimeString() : "Never"}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Active Attempts"
          value={d?.active_count ?? 0}
          icon={<span>⏱️</span>}
          color="blue"
        />
        <StatsCard
          title="Submissions (60m)"
          value={d?.submissions_last_60m ?? 0}
          icon={<span>📊</span>}
          color="green"
        />
        <StatsCard
          title="Top Exam"
          value={d?.running_by_exam?.[0]?.exam_title || "None"}
          icon={<span>🏆</span>}
          color="purple"
        />
      </div>

      {/* Active by Exam */}
      <ModernCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Activity by Exam</h2>
          <div className="text-sm text-gray-500">
            {d?.running_by_exam?.length || 0} exams with active attempts
          </div>
        </div>
        
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="skeleton h-4 w-48"></div>
                <div className="skeleton h-6 w-8"></div>
              </div>
            ))}
          </div>
        ) : d?.running_by_exam?.length ? (
          <div className="space-y-2">
            {d.running_by_exam.map((exam) => (
              <div key={exam.exam_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-gray-900">{exam.exam_title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">{exam.count}</span>
                  <span className="text-sm text-gray-500">active</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">😴</div>
            <p>No active exam attempts right now</p>
          </div>
        )}
      </ModernCard>

      {/* Active Attempts Table */}
      <ModernCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Attempts</h2>
          <div className="text-sm text-gray-500">
            {d?.active_list?.length || 0} students currently taking exams
          </div>
        </div>
        
        <ModernTable
          columns={[
            { key: "exam", label: "Exam" },
            { key: "student", label: "Student" },
            { key: "ip", label: "IP Address", width: "150px" },
            { key: "started", label: "Started", width: "150px" },
            { key: "duration", label: "Duration", width: "100px" },
          ]}
          data={d?.active_list || []}
          renderCell={(item: ActiveItem, column) => {
            switch (column.key) {
              case "exam":
                return (
                  <div>
                    <div className="font-medium text-gray-900">{item.exam_title}</div>
                    <div className="text-sm text-gray-500">ID: {item.exam_id.slice(0, 8)}...</div>
                  </div>
                );
              case "student":
                return item.student_name || <span className="text-gray-400">Anonymous</span>;
              case "ip":
                return (
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {item.ip_address || "Unknown"}
                  </code>
                );
              case "started":
                return new Date(item.started_at).toLocaleString();
              case "duration":
                const startTime = new Date(item.started_at).getTime();
                const now = new Date().getTime();
                const duration = Math.floor((now - startTime) / 1000 / 60);
                const isExpired = duration > 120; // Consider expired if over 2 hours
                return (
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      isExpired ? 'text-red-600' : 
                      duration > 60 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {duration}m
                    </span>
                    {isExpired && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Expired
                      </span>
                    )}
                  </div>
                );
              default:
                return null;
            }
          }}
          loading={isLoading}
          emptyMessage="No active attempts at the moment"
        />
      </ModernCard>

      {/* Recent Submissions */}
      <ModernCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Submissions</h2>
          <div className="text-sm text-gray-500">
            Last 60 minutes • {d?.recent_list?.length || 0} submissions
          </div>
        </div>
        
        <ModernTable
          columns={[
            { key: "exam", label: "Exam" },
            { key: "student", label: "Student" },
            { key: "ip", label: "IP Address", width: "150px" },
            { key: "duration", label: "Duration", width: "100px" },
            { key: "submitted", label: "Submitted", width: "150px" },
            { key: "status", label: "Status", width: "120px" },
          ]}
          data={d?.recent_list || []}
          renderCell={(item: RecentItem, column) => {
            switch (column.key) {
              case "exam":
                return (
                  <div>
                    <div className="font-medium text-gray-900">{item.exam_title}</div>
                    <div className="text-sm text-gray-500">ID: {item.exam_id.slice(0, 8)}...</div>
                  </div>
                );
              case "student":
                return item.student_name || <span className="text-gray-400">Anonymous</span>;
              case "ip":
                return (
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {item.ip_address || "Unknown"}
                  </code>
                );
              case "duration":
                const startTime = new Date(item.started_at).getTime();
                const endTime = new Date(item.submitted_at).getTime();
                const duration = Math.floor((endTime - startTime) / 1000 / 60);
                return <span className="font-medium">{duration}m</span>;
              case "submitted":
                return new Date(item.submitted_at).toLocaleString();
              case "status":
                const status = (item.completion_status ?? "in_progress") as "in_progress" | "submitted" | "abandoned" | "invalid";
                return (
                  <StatusBadge 
                    status={status} 
                    size="sm" 
                  />
                );
              default:
                return null;
            }
          }}
          loading={isLoading}
          emptyMessage="No recent submissions in the last 60 minutes"
        />
      </ModernCard>
    </div>
  );
}