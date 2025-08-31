import { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

export interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export type VariantClasses = Record<ButtonVariant, string>;

export type SizeClasses = Record<ButtonSize, string>;