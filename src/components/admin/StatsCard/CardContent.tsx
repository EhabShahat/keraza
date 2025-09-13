import React from "react";
import { CardColor, TrendData } from "./types";
import { colorClasses, iconBgClasses } from "./utils";

interface CardContentProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: TrendData;
  color: CardColor;
  href?: string;
}

export default function CardContent({ title, value, icon, trend, color, href }: CardContentProps) {
  return (
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
}