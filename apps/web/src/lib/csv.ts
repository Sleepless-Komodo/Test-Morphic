type Cell = string | number | boolean | Date | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Quote when the value holds a delimiter, quote or line break; double inner quotes (RFC 4180).
  // A leading =, +, - or @ is prefixed with ' so spreadsheet apps do not run it as a formula.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  // BOM so Excel opens UTF-8 (Indonesian names, currency symbols) correctly.
  downloadBlob(new Blob(['﻿', toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), filename);
}
