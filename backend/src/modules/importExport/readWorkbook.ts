import ExcelJS from "exceljs";
import { HttpError } from "../../middleware/errorHandler";

/** Largest sheet we'll read — far above the real tracker, stops a crafted file from exhausting memory. */
const MAX_ROWS = 20_000;
const MAX_COLS = 200;

/**
 * exceljs returns a date's wall-clock time as if it were UTC; re-read it as local time so a cell
 * showing 6 Jan 2025 becomes local midnight on 6 Jan (what the import has always used).
 */
function localDate(date: Date): Date {
  return new Date(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()
  );
}

/** A cell's value as a plain number / string / Date / boolean, or "" when empty. */
function plainValue(cell: ExcelJS.Cell): unknown {
  // Formulas: use the cached result. (cell.value drops a result of 0 — exceljs bug — cell.result doesn't.)
  if (cell.type === ExcelJS.ValueType.Formula) return plainResult(cell.result);
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : localDate(value);
  if (typeof value !== "object") return value;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("hyperlink" in value) return (value as ExcelJS.CellHyperlinkValue).text ?? "";
  return "";
}

function plainResult(result: ExcelJS.CellFormulaValue["result"]): unknown {
  if (result === undefined || result === null) return "";
  if (result instanceof Date) return Number.isNaN(result.getTime()) ? "" : localDate(result);
  if (typeof result === "object") return ""; // an error such as #N/A
  return result;
}

/**
 * Reads one sheet of an .xlsx upload as an array of rows (index 0 = sheet row 1), each an array of
 * plain cell values (index 0 = column A). Dates come back as Date objects.
 */
export async function readSheetRows(buffer: Buffer, sheetName: string): Promise<unknown[][]> {
  // .xlsx files are ZIP archives; anything else is rejected before parsing.
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new HttpError(400, "Upload an Excel workbook (.xlsx)");
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new HttpError(400, "Could not read the uploaded file as an Excel workbook");
  }
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new HttpError(400, `Workbook does not contain a "${sheetName}" sheet`);
  if (sheet.rowCount > MAX_ROWS) throw new HttpError(400, `Sheet has more than ${MAX_ROWS} rows`);

  const rows: unknown[][] = [];
  const width = Math.min(sheet.columnCount, MAX_COLS);
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: unknown[] = [];
    for (let c = 1; c <= width; c++) {
      const cell = row.getCell(c);
      // A merged range keeps its value in the top-left cell only (exceljs repeats it everywhere).
      values.push(cell.isMerged && cell.master !== cell ? "" : plainValue(cell));
    }
    rows.push(values);
  }
  // Drop trailing empty rows, as SheetJS did.
  while (rows.length && rows[rows.length - 1].every((v) => v === "")) rows.pop();
  return rows;
}
