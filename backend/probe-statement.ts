import { readFileSync } from 'node:fs';
import { readReport } from './src/modules/imports/report.reader.js';
import { parseInfinitePayStatement } from './src/modules/imports/infinitepay.parser.js';

const buffer = readFileSync(process.argv[2] ?? '');
const tables = readReport(buffer, 'relatorio.pdf');
const { rows, skipped, asides } = parseInfinitePayStatement(tables, { defaultCommissionRate: 0 });

const money = (n: number) => n.toFixed(2);
const receitas = rows.filter((r) => r.type === 'receita');
const despesas = rows.filter((r) => r.type === 'despesa');

console.log(`lancamentos=${rows.length}  ignoradas=${skipped.length}`);
console.log(`receitas: n=${receitas.length} total=${money(receitas.reduce((s, r) => s + r.grossAmount, 0))}`);
console.log(`despesas: n=${despesas.length} total=${money(despesas.reduce((s, r) => s + r.grossAmount, 0))}`);
console.log(`periodo: ${rows[0]?.occurredAt.toISOString().slice(0,10)} .. ${rows[rows.length-1]?.occurredAt.toISOString().slice(0,10)}`);
console.log('\n-- por categoria --');
const byCat = new Map<string, [number, number]>();
for (const r of rows) {
  const e = byCat.get(r.category) ?? [0, 0];
  byCat.set(r.category, [e[0] + 1, e[1] + r.grossAmount]);
}
for (const [cat, [n, total]] of byCat) console.log(`  ${cat.padEnd(26)} n=${String(n).padStart(3)}  ${money(total).padStart(10)}`);
console.log('\n-- fora dos lancamentos (asides) --');
for (const a of asides) console.log(`  ${a.label}: n=${a.count} total=${money(a.amount)}\n    ${a.reason}`);
console.log('\n-- ignoradas --');
for (const s of skipped) console.log(`  linha ${s.line}: ${s.reason}`);
console.log('\n-- amostra --');
for (const r of rows.slice(0, 4)) {
  console.log(`  ${r.occurredAt.toISOString().slice(0,16)} ${r.type.padEnd(8)} ${money(r.grossAmount).padStart(9)} ${r.paymentMethod.padEnd(14)} ${r.description}`);
}
console.log(`  ...\n  externalId exemplo: ${rows[0]?.externalId}`);
