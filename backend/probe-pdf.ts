import { readFileSync, writeFileSync } from 'node:fs';
import { readPdf } from './src/modules/imports/pdf.reader.js';

const buffer = readFileSync(process.argv[2] ?? '');
const pages = readPdf(buffer);
const out: string[] = [`paginas=${pages.length}`];
for (const page of pages) {
  out.push(`===== ${page.name} (${page.rows.length} linhas)`);
  for (const row of page.rows) out.push('  ' + row.join(' | '));
}
writeFileSync(process.argv[3] ?? 'out.txt', out.join('\n'), 'utf8');
console.log(`paginas=${pages.length} linhas=${pages.reduce((n, p) => n + p.rows.length, 0)}`);
