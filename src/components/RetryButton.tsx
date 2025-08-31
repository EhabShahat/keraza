"use client";

import { useState } from "react";

interface RetryButtonProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export default function RetryButton({ className = "", children, onClick }: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleClick = async () => {
    setIsRetrying(true);
    try {
      if (onClick) {
        await onClick();
      } else {
        window.location.reload();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isRetrying}
      className={`${className} ${isRetrying ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isRetrying ? (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          Retrying...
        </span>
      ) : (
        children
      )}
    </button>
  );
}