"use client";

import { ModernTableProps } from "./types";
import TableLoading from "./TableLoading";
import EmptyTable from "./EmptyTable";
import DataTable from "./DataTable";

export default function ModernTable({
  columns,
  data,
  renderCell,
  onRowClick,
  loading = false,
  emptyMessage = "No data available"
}: ModernTableProps) {
  if (loading) {
    return <TableLoading columns={columns} />;
  }

  if (data.length === 0) {
    return <EmptyTable emptyMessage={emptyMessage} />;
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      renderCell={renderCell}
      onRowClick={onRowClick}
    />
  );
}

// Export types for external use
export * from "./types";