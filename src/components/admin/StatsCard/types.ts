import { ReactNode } from "react";

export type CardColor = "blue" | "green" | "orange" | "red" | "purple";

export interface TrendData {
  value: number;
  isPositive: boolean;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  href?: string;
  trend?: TrendData;
  color?: CardColor;
}

export type ColorClasses = Record<CardColor, string>;

export type IconBgClasses = Record<CardColor, string>;