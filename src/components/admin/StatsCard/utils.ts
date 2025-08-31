import { ColorClasses, IconBgClasses } from "./types";

/**
 * Background gradient and text color classes for different card colors
 */
export const colorClasses: ColorClasses = {
  blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
  green: "from-green-50 to-green-100 border-green-200 text-green-700", 
  orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-700",
  red: "from-red-50 to-red-100 border-red-200 text-red-700",
  purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-700"
};

/**
 * Background and text color classes for the icon container
 */
export const iconBgClasses: IconBgClasses = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  orange: "bg-orange-100 text-orange-600", 
  red: "bg-red-100 text-red-600",
  purple: "bg-purple-100 text-purple-600"
};