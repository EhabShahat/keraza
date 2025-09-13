"use client";

import Link from "next/link";
import { StatsCardProps } from "./types";
import CardContent from "./CardContent";

export default function StatsCard({ 
  title, 
  value, 
  icon, 
  href, 
  trend,
  color = "blue" 
}: StatsCardProps) {
  if (href) {
    return (
      <Link href={href}>
        <CardContent 
          title={title}
          value={value}
          icon={icon}
          trend={trend}
          color={color}
          href={href}
        />
      </Link>
    );
  }
  
  return (
    <CardContent 
      title={title}
      value={value}
      icon={icon}
      trend={trend}
      color={color}
    />
  );
}

// Export types for external use
export * from "./types";