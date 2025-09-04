"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";

interface AuditLog {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  meta: any;
  resource_type?: string;
  resource_id?: string;
  user_id?: string;
  users?: {
    email: string;
    raw_user_meta_data: any;
  };
}

export default function AdminAuditPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(0);

  const params = useMemo(() => ({ actor, action, start, end, page }), [actor, action, start, end, page]);

  const { data, isLoading, error } = useQuery<AuditLog[]>({
    queryKey: ["admin", "audit", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (actor) searchParams.set("actor", actor);
      if (action) searchParams.set("action", action);
      if (start) searchParams.set("start", start);
      if (end) searchParams.set("end", end);
      searchParams.set("limit", "200");
      searchParams.set("offset", String(page * 200));
      
      const res = await authFetch(`/api/admin/audit-logs?${searchParams.toString()}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Load logs failed");
      return result.items as AuditLog[];
    },
  });

  const exportCsv = () => {
    const headers = ["created_at", "actor", "action", "resource_type", "resource_id", "meta"];
    const escapeValue = (value: any) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes("\"") || str.includes(",") || str.includes("\n")) {
        return '"' + str.replaceAll('"', '""') + '"';
      }
      return str;
    };
    
    const lines: string[] = [];
    lines.push(headers.join(","));
    
    for (const log of data || []) {
      lines.push([
        escapeValue(log.created_at),
        escapeValue(log.actor),
        escapeValue(log.action),
        escapeValue(log.resource_type),
        escapeValue(log.resource_id),
        escapeValue(JSON.stringify(log.meta)),
      ].join(","));
    }
    
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setActor("");
    setAction("");
    setStart("");
    setEnd("");
    setPage(0);
  };

  const applyFilters = () => {
    setPage(0);
  };

  const columns = [
    { key: "timestamp", label: "Timestamp", width: "180px" },
    { key: "actor", label: "Actor", width: "150px" },
    { key: "action", label: "Action", width: "150px" },
    { key: "resource", label: "Resource", width: "200px" },
    { key: "details", label: "Details" },
  ];

  const renderCell = (log: AuditLog, column: any) => {
    switch (column.key) {
      case "timestamp":
        return (
          <div className="text-sm">
            <div className="font-medium">
              {new Date(log.created_at).toLocaleDateString()}
            </div>
            <div className="text-gray-500">
              {new Date(log.created_at).toLocaleTimeString()}
            </div>
          </div>
        );
      case "actor":
        return (
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              {log.users?.email || log.actor}
            </div>
            {log.users?.email && log.actor !== log.users.email && (
              <div className="text-xs text-gray-500">({log.actor})</div>
            )}
          </div>
        );
      case "action":
        const getActionStyle = (action: string) => {
          if (action.includes('create') || action.includes('add')) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
          if (action.includes('update') || action.includes('edit') || action.includes('modify')) return 'bg-blue-100 text-blue-800 border border-blue-200';
          if (action.includes('delete') || action.includes('remove') || action.includes('block')) return 'bg-red-100 text-red-800 border border-red-200';
          if (action.includes('login') || action.includes('auth') || action.includes('signin')) return 'bg-purple-100 text-purple-800 border border-purple-200';
          if (action.includes('publish') || action.includes('activate')) return 'bg-orange-100 text-orange-800 border border-orange-200';
          return 'bg-slate-100 text-slate-800 border border-slate-200';
        };
        
        return (
          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${getActionStyle(log.action)}`}>
            {log.action.replace(/_/g, ' ').toUpperCase()}
          </span>
        );
      case "resource":
        return log.resource_type ? (
          <div className="text-sm">
            <div className="font-medium">{log.resource_type}</div>
            {log.resource_id && (
              <div className="text-gray-500 font-mono text-xs">
                {log.resource_id.slice(0, 8)}...
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case "details":
        return (
          <div className="max-w-md">
            {log.meta && Object.keys(log.meta).length > 0 ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                  View details
                </summary>
                <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                  {JSON.stringify(log.meta, null, 2)}
                </pre>
              </details>
            ) : (
              <span className="text-gray-400">No details</span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            Audit Logs
          </h1>
          <p className="text-slate-600 mt-2 text-lg">Track all administrative actions and system events across your platform</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg">
            <span className="font-medium">{data?.length || 0}</span> entries
          </div>
          <ActionButton
            variant="secondary"
            onClick={exportCsv}
            disabled={!data || data.length === 0}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            Export CSV
          </ActionButton>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800">Filter & Search</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              👤 Actor
            </label>
            <SearchInput
              placeholder="Search by name or email"
              value={actor}
              onChange={setActor}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ⚡ Action
            </label>
            <SearchInput
              placeholder="e.g. create, delete, update"
              value={action}
              onChange={setAction}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              📅 Start Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              📅 End Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          
          <div className="flex items-end">
            <ActionButton
              variant="primary"
              onClick={applyFilters}
              className="w-full"
            >
              Apply Filters
            </ActionButton>
          </div>
          
          <div className="flex items-end">
            <ActionButton
              variant="secondary"
              onClick={clearFilters}
              className="w-full"
            >
              Clear All
            </ActionButton>
          </div>
        </div>
        
        {(actor || action || start || end) && (
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Active filters applied</span>
              <span className="text-slate-400">•</span>
              <span>Page {page + 1}</span>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Activity Timeline
          </h3>
        </div>
        <ModernTable
          columns={columns}
          data={data || []}
          renderCell={renderCell}
          loading={isLoading}
          emptyMessage="No audit logs found matching your criteria"
        />
      </div>

      {/* Pagination */}
      {data && data.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{data.length}</span> entries on this page
              </div>
              <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                Page {page + 1}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                }
              >
                Previous
              </ActionButton>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={data.length < 200}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                }
              >
                Next
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-red-800">Error loading audit logs</p>
              <p className="text-sm text-red-600 mt-1">{(error as any).message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}