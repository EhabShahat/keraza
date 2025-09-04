import { ReactNode } from "react";

export interface ModernCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

export type PaddingSize = "sm" | "md" | "lg";

export type PaddingClasses = Record<PaddingSize, string>;