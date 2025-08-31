"use client";

import React from "react";
import { ProgressBarProps } from "./types";
import { clampValue } from "./utils";
import ProgressBarDisplay from "./ProgressBarDisplay";

export default function ProgressBar({ value }: ProgressBarProps) {
  // Ensure value is within valid range
  const clampedValue = clampValue(value);
  
  return <ProgressBarDisplay value={clampedValue} />;
}

// Export types for external use
export * from "./types";