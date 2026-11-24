// Regressão dos achados de ReDoS do CodeQL no leitor de PDF.
import { describe, expect, it } from 'vitest';
import { parseToUnicode } from '../modules/imports/pdf.reader.js';

describe('parseToUnicode resiste a CMap hostil', () => {
  it('lê bfchar e bfrange normalmente', () => {
    const map = parseToUnicode('beginbfchar <01> <0041> endbfchar beginbfrange <02> <03> <0042> endbfrange');
    expect(map.get(1)).toBe('A');
    expect(map.get(2)).toBe('B');
    expect(map.get(3)).toBe('C');
  });

  it('processa 200 mil marcadores sem fechamento em tempo linear', () => {
    const hostile = 'beginbfchar'.repeat(100_000) + 'beginbfrange'.repeat(100_000);
    const started = performance.now();
    expect(parseToUnicode(hostile).size).toBe(0);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
