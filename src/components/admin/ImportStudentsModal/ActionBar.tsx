import React from "react";
import ActionButton from "../ActionButton";
import { ActionBarProps } from "./types";

export default function ActionBar({
  isPreviewMode,
  previewDataLength,
  onBackToUpload,
  onClose,
  onImport,
  isImporting
}: ActionBarProps) {
  if (!isPreviewMode) {
    return (
      <div className="flex justify-end gap-3 pt-4">
        <ActionButton
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-3 pt-4">
      <ActionButton
        variant="secondary"
        onClick={onBackToUpload}
        disabled={isImporting}
      >
        Back
      </ActionButton>
      <ActionButton
        variant="secondary"
        onClick={onClose}
        disabled={isImporting}
      >
        Cancel
      </ActionButton>
      <ActionButton
        variant="primary"
        onClick={onImport}
        loading={isImporting}
      >
        Import {previewDataLength} Students
      </ActionButton>
    </div>
  );
}