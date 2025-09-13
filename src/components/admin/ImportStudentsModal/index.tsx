"use client";

import { ImportStudentsModalProps } from "./types";
import { useImportStudents } from "./hooks/useImportStudents";
import FileUpload from "./FileUpload";
import FormatInstructions from "./FormatInstructions";
import PreviewTable from "./PreviewTable";
import ActionBar from "./ActionBar";

export default function ImportStudentsModal({ examId, isOpen, onClose }: ImportStudentsModalProps) {
  const {
    file,
    previewData,
    isPreviewMode,
    fileInputRef,
    handleFileChange,
    handleImport,
    handleBackToUpload,
    handleClose,
    isImporting
  } = useImportStudents({ onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-semibold mb-4">
          {isPreviewMode ? "Preview Import Data" : "Import Students"}
        </h3>
        
        {!isPreviewMode ? (
          <div className="space-y-4">
            <FileUpload 
              onFileSelect={(file) => handleFileChange({ target: { files: [file] } } as any)}
              file={file}
            />
            
            <FormatInstructions />

            <ActionBar 
              isPreviewMode={isPreviewMode}
              previewDataLength={previewData.length}
              onBackToUpload={handleBackToUpload}
              onClose={handleClose}
              onImport={handleImport}
              isImporting={isImporting}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <PreviewTable previewData={previewData} />

            <ActionBar 
              isPreviewMode={isPreviewMode}
              previewDataLength={previewData.length}
              onBackToUpload={handleBackToUpload}
              onClose={handleClose}
              onImport={handleImport}
              isImporting={isImporting}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Export types for external use
export * from "./types";