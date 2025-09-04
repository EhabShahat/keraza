"use client";

import { AddStudentModalProps } from "./types";
import { useAddStudent } from "./hooks/useAddStudent";
import StudentForm from "./StudentForm";

export default function AddStudentModal({ examId, isOpen, onClose }: AddStudentModalProps) {
  const {
    formData,
    handleChange,
    handleSubmit,
    handleClose,
    isSubmitting
  } = useAddStudent({ onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Add New Student</h3>
        
        <StudentForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onCancel={handleClose}
        />
      </div>
    </div>
  );
}

// Export types for external use
export * from "./types";