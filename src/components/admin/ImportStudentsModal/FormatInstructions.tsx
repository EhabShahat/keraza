import React from "react";

export default function FormatInstructions() {
  return (
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
  );
}