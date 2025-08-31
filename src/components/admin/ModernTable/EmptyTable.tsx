import React from "react";

interface EmptyTableProps {
  emptyMessage: string;
}

export default function EmptyTable({ emptyMessage }: EmptyTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="text-gray-400 text-4xl mb-4">📋</div>
      <p className="text-gray-500">{emptyMessage}</p>
    </div>
  );
}