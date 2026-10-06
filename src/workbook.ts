import * as XLSX from 'xlsx';

// Keeps very large sheets from exhausting memory on a phone.
const MAX_CELLS = 1_000_000;

export type Sheet = {
  name: string;
  rows: string[][];
  // 1 where the cell is numeric (rendered right-aligned), per row.
  numeric: Uint8Array[];
  colWidths: number[];
  rowOffset: number;
  colOffset: number;
  truncated: boolean;
  worksheet: XLSX.WorkSheet;
};

export type Workbook = {
  fileName: string;
  sheets: Sheet[];
};

export const SUPPORTED_EXTENSIONS = ['xlsx', 'xlsm', 'xlsb', 'xls', 'csv', 'tsv', 'ods'];

export function parseWorkbook(data: ArrayBuffer, fileName: string): Workbook {
  const wb = XLSX.read(new Uint8Array(data), { type: 'array', cellFormula: true });
  const sheets = wb.SheetNames.map((name) => buildSheet(name, wb.Sheets[name]));
  return { fileName, sheets };
}

function buildSheet(name: string, ws: XLSX.WorkSheet): Sheet {
  const ref = ws['!ref'];
  if (!ref) {
    return { name, rows: [], numeric: [], colWidths: [], rowOffset: 0, colOffset: 0, truncated: false, worksheet: ws };
  }
  const range = XLSX.utils.decode_range(ref);
  const colCount = range.e.c - range.s.c + 1;
  const totalRows = range.e.r - range.s.r + 1;
  const rowCount = Math.min(totalRows, Math.max(1, Math.floor(MAX_CELLS / colCount)));

  const rows: string[][] = [];
  const numeric: Uint8Array[] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: string[] = new Array(colCount);
    const flags = new Uint8Array(colCount);
    for (let c = 0; c < colCount; c++) {
      const cell: XLSX.CellObject | undefined = ws[XLSX.utils.encode_cell({ r: r + range.s.r, c: c + range.s.c })];
      if (!cell || cell.t === 'z') {
        row[c] = '';
      } else {
        row[c] = cell.w ?? XLSX.utils.format_cell(cell);
        if (cell.t === 'n' || cell.t === 'd') flags[c] = 1;
      }
    }
    rows.push(row);
    numeric.push(flags);
  }

  return {
    name,
    rows,
    numeric,
    colWidths: measureColumns(ws, rows, colCount, range.s.c),
    rowOffset: range.s.r,
    colOffset: range.s.c,
    truncated: rowCount < totalRows,
    worksheet: ws,
  };
}

function measureColumns(ws: XLSX.WorkSheet, rows: string[][], colCount: number, colOffset: number): number[] {
  const declared = ws['!cols'];
  const sample = Math.min(rows.length, 300);
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    const info = declared?.[c + colOffset];
    if (info?.hidden) {
      widths.push(0);
      continue;
    }
    let chars = info?.wch ?? 0;
    if (info?.wpx) chars = Math.max(chars, info.wpx / 7);
    for (let r = 0; r < sample; r++) chars = Math.max(chars, rows[r][c].length);
    widths.push(Math.round(Math.min(280, Math.max(64, chars * 7.5 + 16))));
  }
  return widths;
}

export function columnName(index: number): string {
  return XLSX.utils.encode_col(index);
}

export function cellAddress(sheet: Sheet, r: number, c: number): string {
  return XLSX.utils.encode_cell({ r: r + sheet.rowOffset, c: c + sheet.colOffset });
}

// What the formula bar shows: the formula when there is one, otherwise the full value.
export function cellContents(sheet: Sheet, r: number, c: number): string {
  const cell: XLSX.CellObject | undefined = sheet.worksheet[cellAddress(sheet, r, c)];
  if (!cell) return '';
  if (cell.f) return `=${cell.f}`;
  return sheet.rows[r]?.[c] ?? '';
}
