"use client";

import { StatusBadgeProps } from "./types";
import { sizeClasses, statusConfig } from "./utils";

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`
      inline-flex items-center gap-1.5 font-medium rounded-full border
      ${sizeClasses[size]}
      ${config.bg} ${config.text} ${config.border}
    `}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
}

// Export types for external use
export * from "./types";