"use client";

import { ActionButtonProps } from "./types";
import { baseClasses, variantClasses, sizeClasses } from "./utils";
import ButtonContent from "./ButtonContent";

export default function ActionButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className = "",
  type: buttonType = "button",
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      type={buttonType}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled || loading ? "cursor-not-allowed opacity-60" : ""}
        ${className}
      `}
    >
      <ButtonContent loading={loading} icon={icon}>
        {children}
      </ButtonContent>
    </button>
  );
}

// Export types for external use
export * from "./types";