import React from "react";

export default function LoadingIndicator() {
  return (
    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
      <div className="spinner"></div>
    </div>
  );
}