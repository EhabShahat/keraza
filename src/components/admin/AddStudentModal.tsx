"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ActionButton from "./ActionButton";

interface AddStudentModalProps {
  examId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddStudentModal({ examId, isOpen, onClose }: AddStudentModalProps) {
  const [studentName, setStudentName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [customCode, setCustomCode] = useState("");
  
  const toast = useToast();
  const queryClient = useQueryClient();

  const addStudentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        student_name: studentName.trim() || null,
        mobile_number: mobileNumber.trim() || null,
        code: customCode.trim() || undefined
      };
      
      const res = await authFetch(`/api/admin/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to add student");
      return result.student;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students", "global"] });
      toast.success({ 
        title: "Student Added", 
        message: `Added student with code ${student.code}` 
      });
      handleClose();
    },
    onError: (error: any) => {
      toast.error({ title: "Add Student Failed", message: error.message });
    },
  });

  const handleClose = () => {
    setStudentName("");
    setMobileNumber("");
    setCustomCode("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() && !mobileNumber.trim()) {
      toast.error({ title: "Validation Error", message: "Please provide at least a name or mobile number" });
      return;
    }
    addStudentMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Add New Student</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student Name
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter student name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter mobile number (for WhatsApp)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Code (Optional)
            </label>
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Leave empty to auto-generate"
            />
            <p className="text-xs text-gray-500 mt-1">
              If left empty, a unique code will be generated automatically
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <ActionButton
              variant="secondary"
              onClick={handleClose}
              disabled={addStudentMutation.isPending}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="primary"
              type="submit"
              loading={addStudentMutation.isPending}
            >
              Add Student
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}