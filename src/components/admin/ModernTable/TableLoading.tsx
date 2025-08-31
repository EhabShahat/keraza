import React from "react";
import { Column } from "./types";

interface TableLoadingProps {
  columns: Column[];
}

export default function TableLoading({ columns }: TableLoadingProps) {
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