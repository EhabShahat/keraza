import { FileValidationResult, ToastMessage } from "./types";

/**
 * Allowed file types for logo upload
 */
export const allowedFileTypes = [
  "image/jpeg", 
  "image/jpg", 
  "image/png", 
  "image/gif", 
  "image/webp", 
  "image/svg+xml"
];

/**
 * Maximum file size for logo upload (5MB)
 */
export const maxFileSize = 5 * 1024 * 1024;

/**
 * Validates a file for logo upload
 * @param file The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): FileValidationResult {
  // Validate file type
  if (!allowedFileTypes.includes(file.type)) {
    return {
      valid: false,
      error: {
        title: "Invalid File Type",
        message: "Please upload a JPEG, PNG, GIF, WebP, or SVG image."
      }
    };
  }

  // Validate file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: {
        title: "File Too Large",
        message: "Please upload an image smaller than 5MB."
      }
    };
  }

  return { valid: true };
}

/**
 * Extracts filename from a URL
 * @param url The URL to extract filename from
 * @returns The extracted filename
 */
export function extractFilenameFromUrl(url: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  return pathParts[pathParts.length - 1];
}