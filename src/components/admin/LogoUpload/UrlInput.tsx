import React from "react";

interface UrlInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
  uploading: boolean;
}

export default function UrlInput({ value, onChange, disabled, uploading }: UrlInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Logo URL (Alternative)
      </label>
      <input
        type="url"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="https://example.com/logo.png"
        disabled={disabled || uploading}
      />
      <p className="text-xs text-gray-500 mt-1">
        You can also paste a direct URL to your logo image
      </p>
    </div>
  );
}