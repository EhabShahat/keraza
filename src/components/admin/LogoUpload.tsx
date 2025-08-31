"use client";

import { useState, useRef } from "react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";

/**
 * SECURITY WARNING: This component currently allows anyone to upload logos
 * for development purposes. In production, this should be restricted to 
 * admin users only. See LOGO_SECURITY_MIGRATION.md for migration steps.
 */

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
  disabled?: boolean;
}

export default function LogoUpload({ currentLogoUrl, onLogoChange, disabled }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const saveLogoToDatabase = async (logoUrl: string | null) => {
    try {
      // Get current settings first
      const settingsResponse = await fetch("/api/admin/settings");
      let currentSettings = {};
      
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        currentSettings = settingsData.item || {};
      }

      // Update with new logo URL
      const updatedSettings = {
        ...currentSettings,
        brand_logo_url: logoUrl || ""
      };

      // Save to database
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save settings");
      }

      console.log("Logo saved to database:", result.item);
      return result.item;
    } catch (error) {
      console.error("Database save error:", error);
      throw error;
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error({ 
        title: "Invalid File Type", 
        message: "Please upload a JPEG, PNG, GIF, WebP, or SVG image." 
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error({ 
        title: "File Too Large", 
        message: "Please upload an image smaller than 5MB." 
      });
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("logo", file);

      // TEMPORARY: Use regular fetch instead of authFetch for development
      // TODO: Switch back to authFetch when admin authentication is fully implemented
      const response = await fetch("/api/admin/upload/logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      console.log("Logo uploaded successfully:", result.url);
      
      // Save to database immediately
      await saveLogoToDatabase(result.url);
      
      onLogoChange(result.url);
      toast.success({ 
        title: "Logo Updated", 
        message: "Your logo has been uploaded and saved successfully." 
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error({ 
        title: "Upload Failed", 
        message: error.message || "Failed to upload logo" 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    try {
      // Extract filename from URL
      const url = new URL(currentLogoUrl);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      // TEMPORARY: Use regular fetch instead of authFetch for development
      // TODO: Switch back to authFetch when admin authentication is fully implemented
      const response = await fetch(`/api/admin/upload/logo?fileName=${fileName}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Delete failed");
      }

      // Save null logo to database
      await saveLogoToDatabase(null);

      onLogoChange(null);
      toast.success({ 
        title: "Logo Removed", 
        message: "Your logo has been removed successfully." 
      });

    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error({ 
        title: "Remove Failed", 
        message: error.message || "Failed to remove logo" 
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (disabled || uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Brand Logo
      </label>

      {/* Current Logo Preview */}
      {currentLogoUrl && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex-shrink-0">
            <img
              src={currentLogoUrl}
              alt="Current logo"
              className="h-16 w-auto object-contain rounded border bg-white p-2"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21,15 16,10 5,21'/%3E%3C/svg%3E";
              }}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Current Logo</p>
            <p className="text-xs text-gray-500 break-all">{currentLogoUrl}</p>
          </div>
          <button
            type="button"
            onClick={handleRemoveLogo}
            disabled={disabled || uploading}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
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
                {currentLogoUrl ? 'Upload New Logo' : 'Upload Logo'}
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

      {/* URL Input Fallback */}
      <div className="text-center text-xs text-gray-500">
        <span>or</span>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Logo URL (Alternative)
        </label>
        <input
          type="url"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={currentLogoUrl || ""}
          onChange={(e) => onLogoChange(e.target.value || null)}
          placeholder="https://example.com/logo.png"
          disabled={disabled || uploading}
        />
        <p className="text-xs text-gray-500 mt-1">
          You can also paste a direct URL to your logo image
        </p>
      </div>
    </div>
  );
}