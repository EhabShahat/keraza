"use client";

import { SearchInputProps } from "./types";
import { useSearchInput } from "./hooks/useSearchInput";
import SearchIcon from "./SearchIcon";
import ClearButton from "./ClearButton";
import LoadingIndicator from "./LoadingIndicator";

export default function SearchInput({
  placeholder = "Search...",
  value,
  onChange,
  onSearch,
  loading = false,
  className = ""
}: SearchInputProps) {
  const {
    localValue,
    handleKeyDown,
    handleClear,
    handleChange,
    handleBlur
  } = useSearchInput({ value, onChange, onSearch });

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <SearchIcon />
      </div>
      <input
        type="text"
        className="
          block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          bg-white text-gray-900 placeholder-gray-500
          transition-all duration-200
        "
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {localValue && <ClearButton onClick={handleClear} />}
      {loading && <LoadingIndicator />}
    </div>
  );
}

// Export types for external use
export * from "./types";