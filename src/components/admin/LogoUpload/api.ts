/**
 * API functions for logo upload operations
 */

/**
 * Saves logo URL to database
 * @param logoUrl The logo URL to save
 * @returns The updated settings
 */
export async function saveLogoToDatabase(logoUrl: string | null) {
  try {
    // Get current settings first
    const settingsResponse = await fetch("/api/admin/settings");
    let currentSettings = {};
    
    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      currentSettings = settingsData.item || {};
    }

    // Update with new logo URL
    const updatedSettings = {
      ...currentSettings,
      brand_logo_url: logoUrl || ""
    };

    // Save to database
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedSettings),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to save settings");
    }

    console.log("Logo saved to database:", result.item);
    return result.item;
  } catch (error) {
    console.error("Database save error:", error);
    throw error;
  }
}

/**
 * Uploads a logo file to the server
 * @param file The file to upload
 * @returns The URL of the uploaded logo
 */
export async function uploadLogo(file: File) {
  const formData = new FormData();
  formData.append("logo", file);

  // TEMPORARY: Use regular fetch instead of authFetch for development
  // TODO: Switch back to authFetch when admin authentication is fully implemented
  const response = await fetch("/api/admin/upload/logo", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Upload failed");
  }

  console.log("Logo uploaded successfully:", result.url);
  return result.url;
}

/**
 * Deletes a logo from the server
 * @param fileName The filename to delete
 */
export async function deleteLogo(fileName: string) {
  // TEMPORARY: Use regular fetch instead of authFetch for development
  // TODO: Switch back to authFetch when admin authentication is fully implemented
  const response = await fetch(`/api/admin/upload/logo?fileName=${fileName}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Delete failed");
  }
}