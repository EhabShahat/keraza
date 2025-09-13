import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { StudentItem } from "../types";
import { parseStudentFile, validateFile } from "../utils";
import { importStudents } from "../api";

export function useImportStudents({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<StudentItem[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const toast = useToast();
  const queryClient = useQueryClient();

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setIsPreviewMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      toast.error({ 
        title: "Invalid File", 
        message: validation.message || "Invalid file format" 
      });
      return;
    }

    setFile(selectedFile);
    try {
      const data = await parseStudentFile(selectedFile);
      setPreviewData(data);
      setIsPreviewMode(true);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error({ 
        title: "File Parse Error", 
        message: "Could not parse the uploaded file. Please check the format." 
      });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    handleFileSelect(selectedFile);
  };

  const importMutation = useMutation({
    mutationFn: async () => importStudents(previewData),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students", "global"] });
      
      if (result.errors.length > 0) {
        toast.warning({ 
          title: "Import Partially Successful", 
          message: `Added ${result.success} students. ${result.errors.length} failed.` 
        });
      } else {
        toast.success({ 
          title: "Import Successful", 
          message: `Added ${result.success} students` 
        });
      }
      
      handleClose();
    },
    onError: (error: any) => {
      toast.error({ 
        title: "Import Failed", 
        message: error.message 
      });
    },
  });

  const handleImport = () => {
    if (previewData.length === 0) {
      toast.error({ 
        title: "No Data", 
        message: "No valid data to import" 
      });
      return;
    }
    importMutation.mutate();
  };

  const handleBackToUpload = () => {
    setIsPreviewMode(false);
    setPreviewData([]);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    file,
    previewData,
    isPreviewMode,
    fileInputRef,
    handleFileChange,
    handleImport,
    handleBackToUpload,
    handleClose,
    isImporting: importMutation.isPending
  };
}