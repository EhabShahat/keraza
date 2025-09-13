"use client";

import { ModernCardProps } from "./types";
import { paddingClasses } from "./utils";

export default function ModernCard({ 
  children, 
  className = "", 
  hover = false,
  padding = "md" 
}: ModernCardProps) {
  return (
    <div className={`
      bg-white rounded-xl border border-gray-200 shadow-sm
      ${hover ? "hover:shadow-md hover:border-gray-300 transition-all duration-200" : ""}
      ${paddingClasses[padding]}
      ${className}
    `}>
      {children}
    </div>
  );
}

// Export types for external use
export * from "./types";