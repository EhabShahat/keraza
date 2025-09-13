import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { StudentFormData, StudentPayload } from "../types";
import { addStudent } from "../api";

export function useAddStudent({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<StudentFormData>({
    studentName: "",
    mobileNumber: "",
    customCode: ""
  });
  
  const toast = useToast();
  const queryClient = useQueryClient();

  const handleChange = (field: keyof StudentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      studentName: "",
      mobileNumber: "",
      customCode: ""
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addStudentMutation = useMutation({
    mutationFn: async () => {
      const payload: StudentPayload = {
        student_name: formData.studentName.trim() || null,
        mobile_number: formData.mobileNumber.trim() || null,
      };
      
      if (formData.customCode.trim()) {
        payload.code = formData.customCode.trim();
      }
      
      return addStudent(payload);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentName.trim() && !formData.mobileNumber.trim()) {
      toast.error({ title: "Validation Error", message: "Please provide at least a name or mobile number" });
      return;
    }
    addStudentMutation.mutate();
  };

  return {
    formData,
    handleChange,
    handleSubmit,
    handleClose,
    isSubmitting: addStudentMutation.isPending
  };
}