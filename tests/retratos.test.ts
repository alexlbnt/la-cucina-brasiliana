import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDS_RETRATO, ehRetrato, tracosRetrato } from '../src/lib/retratos.ts';

test('são dez retratos, os mesmos que o banco aceita', async () => {
  const sql = await readFile(new URL('../supabase/migrations/0002_retrato_do_perfil.sql', import.meta.url), 'utf8');
  const lista = sql.match(/retrato in \(([^)]*)\)/)?.[1] ?? '';
  const doBanco = [...lista.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.equal(IDS_RETRATO.length, 10);
  assert.deepEqual([...doBanco].sort(), [...IDS_RETRATO].sort());
});

test('só reconhece ids da casa', () => {
  assert.ok(ehRetrato('chef'));
  assert.ok(!ehRetrato('toString'));
  assert.ok(!ehRetrato('https://exemplo.com/foto.png'));
  assert.ok(!ehRetrato(null));
});

test('cada retrato usa as cores pedidas', () => {
  for (const id of IDS_RETRATO) {
    const svg = tracosRetrato(id, 'var(--a)', 'var(--b)');
    assert.match(svg, /stroke:var\(--a\)/, id);
  }
});
