import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { validateFile, extractFilenameFromUrl } from "../utils";
import { uploadLogo, saveLogoToDatabase, deleteLogo } from "../api";

interface UseLogoUploadProps {
  currentLogoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
}

export function useLogoUpload({ currentLogoUrl, onLogoChange }: UseLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const toast = useToast();

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid && validation.error) {
      toast.error(validation.error);
      return;
    }

    try {
      setUploading(true);

      // Upload the file
      const logoUrl = await uploadLogo(file);
      
      // Save to database
      await saveLogoToDatabase(logoUrl);
      
      // Update state
      onLogoChange(logoUrl);
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
      const fileName = extractFilenameFromUrl(currentLogoUrl);

      // Delete the logo
      await deleteLogo(fileName);

      // Save null logo to database
      await saveLogoToDatabase(null);

      // Update state
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
    
    if (uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!uploading) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return {
    uploading,
    dragOver,
    handleFileSelect,
    handleRemoveLogo,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    setDragOver
  };
}