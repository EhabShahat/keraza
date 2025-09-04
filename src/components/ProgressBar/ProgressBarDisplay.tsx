import React from "react";

interface ProgressBarDisplayProps {
  value: number;
}

export default function ProgressBarDisplay({ value }: ProgressBarDisplayProps) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded">
      <div
        className="h-2 bg-blue-600 rounded"
        style={{ width: `${value}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        role="progressbar"
      />
    </div>
  );
}