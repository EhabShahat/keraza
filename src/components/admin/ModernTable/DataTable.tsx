import React from "react";
import { Column } from "./types";

interface DataTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => React.ReactNode;
  onRowClick?: (item: any) => void;
}

export default function DataTable({ columns, data, renderCell, onRowClick }: DataTableProps) {
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