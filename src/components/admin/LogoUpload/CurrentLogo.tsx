import React from "react";

interface CurrentLogoProps {
  logoUrl: string;
  onRemove: () => void;
  disabled: boolean;
  uploading: boolean;
}

export default function CurrentLogo({ logoUrl, onRemove, disabled, uploading }: CurrentLogoProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
      <div className="flex-shrink-0">
        <img
          src={logoUrl}
          alt="Current logo"
          className="h-16 w-auto object-contain rounded border bg-white p-2"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21,15 16,10 5,21'/%3E%3C/svg%3E";
          }}
        />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">Current Logo</p>
        <p className="text-xs text-gray-500 break-all">{logoUrl}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || uploading}
        className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}