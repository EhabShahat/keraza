export interface ImportStudentsModalProps {
  examId: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface StudentItem {
  student_name?: string | null;
  mobile_number?: string | null;
  code?: string | null;
}

export interface ImportResult {
  success: number;
  errors: Array<{ index: number; error: string }>;
}

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  file: File | null;
}

export interface PreviewTableProps {
  previewData: StudentItem[];
}

export interface ActionBarProps {
  isPreviewMode: boolean;
  previewDataLength: number;
  onBackToUpload: () => void;
  onClose: () => void;
  onImport: () => void;
  isImporting: boolean;
}