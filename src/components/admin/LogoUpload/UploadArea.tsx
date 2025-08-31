import React, { useRef } from "react";

interface UploadAreaProps {
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  dragOver: boolean;
  uploading: boolean;
  disabled: boolean;
  hasCurrentLogo: boolean;
}

export default function UploadArea({
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  dragOver,
  uploading,
  disabled,
  hasCurrentLogo
}: UploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
        ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
        ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
      `}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        className="hidden"
        disabled={disabled || uploading}
      />

      {uploading ? (
        <div className="space-y-2">
          <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Uploading logo...</p>
        </div>
      ) : (
        <div className="space-y-2">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {hasCurrentLogo ? 'Upload New Logo' : 'Upload Logo'}
            </p>
            <p className="text-xs text-gray-500">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPEG, PNG, GIF, WebP, or SVG • Max 5MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}