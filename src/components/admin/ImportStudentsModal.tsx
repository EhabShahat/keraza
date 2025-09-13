"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ActionButton from "./ActionButton";
import { read, utils } from "xlsx";

interface ImportStudentsModalProps {
  examId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface StudentItem {
  student_name?: string | null;
  mobile_number?: string | null;
  code?: string | null;
}

interface ImportResult {
  success: number;
  errors: Array<{ index: number; error: string }>;
}

export default function ImportStudentsModal({ examId, isOpen, onClose }: ImportStudentsModalProps) {
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

  const parseFile = useCallback(async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json<any>(worksheet);

      // Map the data to our expected format
      const mappedData = jsonData.map((row: any) => {
        // Try different possible column names
        const studentName = 
          row.student_name || row.name || row.Name || row["Student Name"] || row.studentName || null;
        
        const mobileNumber = 
          row.mobile_number || row.mobile || row.Mobile || row["Mobile Number"] || 
          row.mobileNumber || row.phone || row.Phone || row["Phone Number"] || null;
        
        const code = 
          row.code || row.Code || row["Student Code"] || row.studentCode || null;

        return {
          student_name: studentName,
          mobile_number: mobileNumber,
          code: code
        };
      });

      setPreviewData(mappedData);
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

    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'csv' && fileExt !== 'xlsx') {
      toast.error({ 
        title: "Invalid File", 
        message: "Please upload a CSV or XLSX file" 
      });
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/students/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: previewData }),
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to import students");
      return result as ImportResult;
    },
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-semibold mb-4">
          {isPreviewMode ? "Preview Import Data" : "Import Students"}
        </h3>
        
        {!isPreviewMode ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx"
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Select CSV or XLSX File
              </label>
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name}
                </p>
              )}
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">File Format Instructions</h4>
              <p className="text-sm text-blue-700 mb-2">
                Your file should contain the following columns:
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 space-y-1 ml-2">
                <li>Student Name (student_name)</li>
                <li>Mobile Number (mobile_number) - Optional</li>
                <li>Code (code) - Optional, will be auto-generated if not provided</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <ActionButton
                variant="secondary"
                onClick={handleClose}
              >
                Cancel
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mobile Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.slice(0, 100).map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.student_name || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.mobile_number || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.code || "(Auto)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 100 && (
                <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500">
                  Showing 100 of {previewData.length} records
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <ActionButton
                variant="secondary"
                onClick={handleBackToUpload}
                disabled={importMutation.isPending}
              >
                Back
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={handleClose}
                disabled={importMutation.isPending}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={handleImport}
                loading={importMutation.isPending}
              >
                Import {previewData.length} Students
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}