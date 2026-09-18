import ExcelJS from "exceljs";

export async function* streamExcelRows(
  filePath: string,
): AsyncGenerator<unknown[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: "ignore",
    sharedStrings: "cache",
    styles: "ignore",
    hyperlinks: "ignore",
    worksheets: "emit",
  });

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      yield values;
    }
    break;
  }
}
