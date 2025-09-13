"use client";

import { ReactNode } from "react";

interface ModernCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

export default function ModernCard({ 
  children, 
  className = "", 
  hover = false,
  padding = "md" 
}: ModernCardProps) {
  const paddingClasses = {
    sm: "p-4",
    md: "p-6", 
    lg: "p-8"
  };

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