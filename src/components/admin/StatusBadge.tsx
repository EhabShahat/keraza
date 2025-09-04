"use client";

interface StatusBadgeProps {
  status: "draft" | "published" | "archived" | "active" | "inactive" | "used" | "unused" 
        | "in_progress" | "submitted" | "abandoned" | "invalid" | "unknown";
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm"
  };

  const statusConfig = {
    draft: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      border: "border-yellow-200",
      dot: "bg-yellow-400",
      label: "Draft"
    },
    published: {
      bg: "bg-green-100", 
      text: "text-green-800",
      border: "border-green-200",
      dot: "bg-green-400",
      label: "Published"
    },
    archived: {
      bg: "bg-gray-100",
      text: "text-gray-800", 
      border: "border-gray-200",
      dot: "bg-gray-400",
      label: "Archived"
    },
    active: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200", 
      dot: "bg-blue-400",
      label: "Active"
    },
    inactive: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
      dot: "bg-gray-400", 
      label: "Inactive"
    },
    used: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      dot: "bg-green-400",
      label: "Used"
    },
    unused: {
      bg: "bg-gray-100", 
      text: "text-gray-800",
      border: "border-gray-200",
      dot: "bg-gray-400",
      label: "Unused"
    },
    in_progress: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
      dot: "bg-blue-400",
      label: "In Progress"
    },
    submitted: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      dot: "bg-green-400",
      label: "Submitted"
    },
    abandoned: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-200",
      dot: "bg-orange-400",
      label: "Abandoned"
    },
    invalid: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
      dot: "bg-red-400",
      label: "Invalid"
    },
    unknown: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
      dot: "bg-gray-400",
      label: "Unknown"
    }
  };

  const config = statusConfig[status];

  return (
    <span className={`
      inline-flex items-center gap-1.5 font-medium rounded-full border
      ${sizeClasses[size]}
      ${config.bg} ${config.text} ${config.border}
    `}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
}