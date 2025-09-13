"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  href?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "blue" | "green" | "orange" | "red" | "purple";
}

export default function StatsCard({ 
  title, 
  value, 
  icon, 
  href, 
  trend,
  color = "blue" 
}: StatsCardProps) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    green: "from-green-50 to-green-100 border-green-200 text-green-700", 
    orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-700",
    red: "from-red-50 to-red-100 border-red-200 text-red-700",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-700"
  };

  const iconBgClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600", 
    red: "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-600"
  };

  const content = (
    <div className={`
      bg-gradient-to-br ${colorClasses[color]}
      rounded-xl border p-6 transition-all duration-200
      ${href ? "hover:shadow-lg hover:scale-105 cursor-pointer" : ""}
    `}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {trend && (
            <div className="flex items-center mt-2 text-xs">
              <span className={`inline-flex items-center ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}>
                {trend.isPositive ? "↗" : "↘"} {Math.abs(trend.value)}%
              </span>
              <span className="ml-1 opacity-60">vs last period</span>
            </div>
          )}
        </div>
        <div className={`
          w-12 h-12 rounded-lg ${iconBgClasses[color]}
          flex items-center justify-center text-xl
        `}>
          {icon}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}