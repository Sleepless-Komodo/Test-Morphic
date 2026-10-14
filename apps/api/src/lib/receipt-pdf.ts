/**
 * One-page text PDF built by hand (standard Helvetica, WinAnsi), so receipts need no PDF library.
 * ponytail: text-only layout; switch to a real PDF library if receipts need logos or tables.
 */

/** Escape for a PDF string literal; anything outside Latin-1 becomes '?'. */
function pdfText(s: string): string {
  return s.replace(/[^\x20-\x7e\xa0-\xff]/g, '?').replace(/[\\()]/g, (ch) => `\\${ch}`);
}

export function buildReceiptPdf(title: string, rows: [label: string, value: string][], footer: string): Buffer {
  const ops: string[] = [`BT /F2 22 Tf 50 780 Td (Morphic) Tj ET`, `BT /F1 13 Tf 50 755 Td (${pdfText(title)}) Tj ET`];
  let y = 710;
  for (const [label, value] of rows) {
    ops.push(`BT /F1 11 Tf 50 ${y} Td (${pdfText(label)}) Tj ET`, `BT /F2 11 Tf 220 ${y} Td (${pdfText(value)}) Tj ET`);
    y -= 22;
  }
  ops.push(`BT /F1 9 Tf 50 ${y - 20} Td (${pdfText(footer)}) Tj ET`);
  const content = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
