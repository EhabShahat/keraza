"use client";
import React from "react";

export default function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  return (
    <div className="w-full h-2 bg-gray-200 rounded">
      <div
        className="h-2 bg-blue-600 rounded"
        style={{ width: `${v}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        role="progressbar"
      />
    </div>
  );
}
