export type StatusType = 
  "draft" | 
  "published" | 
  "archived" | 
  "active" | 
  "inactive" | 
  "used" | 
  "unused" | 
  "in_progress" | 
  "submitted" | 
  "abandoned" | 
  "invalid" | 
  "unknown";

export type BadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  status: StatusType;
  size?: BadgeSize;
}

export type SizeClasses = Record<BadgeSize, string>;

export interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

export type StatusConfigs = Record<StatusType, StatusConfig>;