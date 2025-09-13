import React from "react";
import ActionButton from "../ActionButton";
import { StudentFormProps } from "./types";

export default function StudentForm({
  formData,
  onChange,
  onSubmit,
  isSubmitting,
  onCancel
}: StudentFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Student Name
        </label>
        <input
          type="text"
          value={formData.studentName}
          onChange={(e) => onChange("studentName", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter student name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mobile Number
        </label>
        <input
          type="tel"
          value={formData.mobileNumber}
          onChange={(e) => onChange("mobileNumber", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter mobile number (for WhatsApp)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Custom Code (Optional)
        </label>
        <input
          type="text"
          value={formData.customCode}
          onChange={(e) => onChange("customCode", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Leave empty to auto-generate"
        />
        <p className="text-xs text-gray-500 mt-1">
          If left empty, a unique code will be generated automatically
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <ActionButton
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          type="button"
        >
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          loading={isSubmitting}
        >
          Add Student
        </ActionButton>
      </div>
    </form>
  );
}