import { ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface ModernTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => ReactNode;
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
}