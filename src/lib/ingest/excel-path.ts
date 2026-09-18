import path from "node:path";

export const EXCEL_FILE_NAME = "Data_For_AI.xlsx";

export function excelFilePath(): string {
  return path.join(process.cwd(), EXCEL_FILE_NAME);
}
