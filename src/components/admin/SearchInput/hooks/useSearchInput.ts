import { useState, useEffect } from "react";

interface UseSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
}

export function useSearchInput({ value, onChange, onSearch }: UseSearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onChange(localValue);
      onSearch?.();
    }
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    onChange(localValue);
  };

  return {
    localValue,
    handleKeyDown,
    handleClear,
    handleChange,
    handleBlur
  };
}