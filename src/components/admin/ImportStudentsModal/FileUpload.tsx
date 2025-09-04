import React from "react";
import { FileUploadProps } from "./types";

export default function FileUpload({ onFileSelect, file }: FileUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    onFileSelect(selectedFile);
  };

  return (
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
  );
}