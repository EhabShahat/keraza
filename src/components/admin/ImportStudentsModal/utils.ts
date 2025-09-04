import { read, utils } from "xlsx";
import { StudentItem } from "./types";

/**
 * Validates if the file is a valid CSV or XLSX file
 */
export function validateFile(file: File): { valid: boolean; message?: string } {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (fileExt !== 'csv' && fileExt !== 'xlsx') {
    return {
      valid: false,
      message: "Please upload a CSV or XLSX file"
    };
  }
  
  return { valid: true };
}

/**
 * Parses an Excel or CSV file and extracts student data
 */
export async function parseStudentFile(file: File): Promise<StudentItem[]> {
  const data = await file.arrayBuffer();
  const workbook = read(data);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = utils.sheet_to_json<any>(worksheet);

  // Map the data to our expected format
  return jsonData.map((row: any) => {
    // Try different possible column names
    const studentName = 
      row.student_name || row.name || row.Name || row["Student Name"] || row.studentName || null;
    
    const mobileNumber = 
      row.mobile_number || row.mobile || row.Mobile || row["Mobile Number"] || 
      row.mobileNumber || row.phone || row.Phone || row["Phone Number"] || null;
    
    const code = 
      row.code || row.Code || row["Student Code"] || row.studentCode || null;

    return {
      student_name: studentName,
      mobile_number: mobileNumber,
      code: code
    };
  });
}