import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv.ts';

test('toCsv escapes delimiters, quotes, newlines and formula prefixes', () => {
  const out = toCsv(['a', 'b'], [
    ['x,y', 'say "hi"'],
    ['line\nbreak', null],
    ['=SUM(A1)', -5],
    [new Date('2026-01-02T03:04:05Z'), true],
  ]);
  assert.equal(
    out,
    'a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",\r\n\'=SUM(A1),-5\r\n2026-01-02T03:04:05.000Z,true',
  );
});
