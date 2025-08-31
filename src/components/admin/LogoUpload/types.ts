import { ReactNode } from "react";

export interface LogoUploadProps {
  currentLogoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
  disabled?: boolean;
}

export interface ToastMessage {
  title: string;
  message: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: ToastMessage;
}