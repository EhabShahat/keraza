export interface AddStudentModalProps {
  examId: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface StudentFormData {
  studentName: string;
  mobileNumber: string;
  customCode: string;
}

export interface StudentFormProps {
  formData: StudentFormData;
  onChange: (field: keyof StudentFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  onCancel: () => void;
}

export interface StudentPayload {
  student_name: string | null;
  mobile_number: string | null;
  code?: string;
}