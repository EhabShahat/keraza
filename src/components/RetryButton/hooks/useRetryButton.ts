import { useState } from "react";

interface UseRetryButtonProps {
  onClick?: () => void;
}

interface UseRetryButtonResult {
  isRetrying: boolean;
  handleClick: () => Promise<void>;
}

export function useRetryButton({ onClick }: UseRetryButtonProps): UseRetryButtonResult {
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

  return { isRetrying, handleClick };
}