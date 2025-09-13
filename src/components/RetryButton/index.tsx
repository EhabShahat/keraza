"use client";

import React from "react";
import { RetryButtonProps } from "./types";
import { useRetryButton } from "./hooks/useRetryButton";
import RetryButtonContent from "./RetryButtonContent";

export default function RetryButton({ className = "", children, onClick }: RetryButtonProps) {
  const { isRetrying, handleClick } = useRetryButton({ onClick });

  return (
    <button
      onClick={handleClick}
      disabled={isRetrying}
      className={`${className} ${isRetrying ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <RetryButtonContent isRetrying={isRetrying}>
        {children}
      </RetryButtonContent>
    </button>
  );
}

// Export types for external use
export * from "./types";