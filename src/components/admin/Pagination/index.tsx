"use client";

import React from "react";
import { PaginationProps } from "./types";
import ActionButton from "../ActionButton";

export default function Pagination({
  currentPage,
  totalPages,
  hasNextPage,
  onPageChange,
  pageInfo,
  size = "sm",
  className = ""
}: PaginationProps) {
  const hasPrevious = currentPage > 0;
  const hasNext = totalPages ? currentPage < totalPages - 1 : hasNextPage;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {pageInfo && (
        <div className="text-sm text-gray-600">
          {pageInfo}
        </div>
      )}
      <div className="flex items-center gap-2 ml-auto">
        <ActionButton
          variant="secondary"
          size={size}
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={!hasPrevious}
        >
          Previous
        </ActionButton>
        <ActionButton
          variant="secondary"
          size={size}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
        >
          Next
        </ActionButton>
      </div>
    </div>
  );
}

// Export types for external use
export * from "./types";