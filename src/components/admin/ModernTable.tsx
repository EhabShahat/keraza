"use client";

import { ReactNode } from "react";

interface Column {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
}

interface ModernTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => ReactNode;
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export default function ModernTable({
  columns,
  data,
  renderCell,
  onRowClick,
  loading = false,
  emptyMessage = "No data available"
}: ModernTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                {columns.map((col, j) => (
                  <div key={j} className="skeleton h-6 rounded flex-1"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-gray-400 text-4xl mb-4">📋</div>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-4 text-sm font-semibold text-gray-900
                    ${column.align === "center" ? "text-center" : ""}
                    ${column.align === "right" ? "text-right" : "text-left"}
                  `}
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={index}
                className={`
                  hover:bg-gray-50 transition-colors duration-150
                  ${onRowClick ? "cursor-pointer" : ""}
                `}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      px-6 py-4 text-sm text-gray-900
                      ${column.align === "center" ? "text-center" : ""}
                      ${column.align === "right" ? "text-right" : "text-left"}
                    `}
                  >
                    {renderCell(item, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}