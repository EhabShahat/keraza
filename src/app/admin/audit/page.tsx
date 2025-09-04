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
            <div className="font-medium text-gray-900">{log.actor}</div>
          </div>
        );
      case "action":
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            log.action.includes('create') ? 'bg-green-100 text-green-800' :
            log.action.includes('update') || log.action.includes('edit') ? 'bg-blue-100 text-blue-800' :
            log.action.includes('delete') || log.action.includes('remove') ? 'bg-red-100 text-red-800' :
            log.action.includes('login') || log.action.includes('auth') ? 'bg-purple-100 text-purple-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {log.action}
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
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">Track all administrative actions and system events</p>
        </div>
        <div className="flex items-center gap-3">
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
      <ModernCard>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actor
            </label>
            <SearchInput
              placeholder="Filter by actor"
              value={actor}
              onChange={setActor}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <SearchInput
              placeholder="Filter by action"
              value={action}
              onChange={setAction}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="mt-4 pt-4 border-t text-sm text-gray-600">
            Showing filtered results • Page {page + 1}
          </div>
        )}
      </ModernCard>

      {/* Results */}
      <ModernTable
        columns={columns}
        data={data || []}
        renderCell={renderCell}
        loading={isLoading}
        emptyMessage="No audit logs found matching your criteria"
      />

      {/* Pagination */}
      {data && data.length > 0 && (
        <ModernCard>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {data.length} entries • Page {page + 1}
            </div>
            <div className="flex items-center gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </ActionButton>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={data.length < 200}
              >
                Next
              </ActionButton>
            </div>
          </div>
        </ModernCard>
      )}

      {error && (
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading audit logs</p>
            <p className="text-sm mt-1">{(error as any).message}</p>
          </div>
        </ModernCard>
      )}
    </div>
  );
}