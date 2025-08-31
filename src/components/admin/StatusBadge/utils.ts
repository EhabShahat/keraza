import { SizeClasses, StatusConfigs } from "./types";

/**
 * Size classes for different badge sizes
 */
export const sizeClasses: SizeClasses = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm"
};

/**
 * Configuration for different status types
 */
export const statusConfig: StatusConfigs = {
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
  }
};