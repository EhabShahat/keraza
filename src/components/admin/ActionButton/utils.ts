import { VariantClasses, SizeClasses } from "./types";

/**
 * Base classes for all button variants
 */
export const baseClasses = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

/**
 * Style classes for different button variants
 */
export const variantClasses: VariantClasses = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50",
  success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300",
  warning: "bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500 disabled:bg-orange-300"
};

/**
 * Style classes for different button sizes
 */
export const sizeClasses: SizeClasses = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2"
};