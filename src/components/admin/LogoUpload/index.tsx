"use client";

import { LogoUploadProps } from "./types";
import { useLogoUpload } from "./hooks/useLogoUpload";
import CurrentLogo from "./CurrentLogo";
import UploadArea from "./UploadArea";
import UrlInput from "./UrlInput";

/**
 * SECURITY WARNING: This component currently allows anyone to upload logos
 * for development purposes. In production, this should be restricted to 
 * admin users only. See LOGO_SECURITY_MIGRATION.md for migration steps.
 */
export default function LogoUpload({ currentLogoUrl, onLogoChange, disabled = false }: LogoUploadProps) {
  const {
    uploading,
    dragOver,
    handleFileSelect,
    handleRemoveLogo,
    handleDrop,
    handleDragOver,
    handleDragLeave
  } = useLogoUpload({ currentLogoUrl, onLogoChange });

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Brand Logo
      </label>

      {/* Current Logo Preview */}
      {currentLogoUrl && (
        <CurrentLogo 
          logoUrl={currentLogoUrl}
          onRemove={handleRemoveLogo}
          disabled={disabled}
          uploading={uploading}
        />
      )}

      {/* Upload Area */}
      <UploadArea
        onFileSelect={handleFileSelect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        dragOver={dragOver}
        uploading={uploading}
        disabled={disabled}
        hasCurrentLogo={!!currentLogoUrl}
      />

      {/* URL Input Fallback */}
      <div className="text-center text-xs text-gray-500">
        <span>or</span>
      </div>
      
      <UrlInput
        value={currentLogoUrl ?? null}
        onChange={onLogoChange}
        disabled={disabled}
        uploading={uploading}
      />
    </div>
  );
}

// Export types for external use
export * from "./types";