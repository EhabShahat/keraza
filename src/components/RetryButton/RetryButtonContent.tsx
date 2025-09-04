import React from "react";

interface RetryButtonContentProps {
  isRetrying: boolean;
  children: React.ReactNode;
}

export default function RetryButtonContent({ isRetrying, children }: RetryButtonContentProps) {
  if (isRetrying) {
    return (
      <span className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
        Retrying...
      </span>
    );
  }
  
  return <>{children}</>;
}