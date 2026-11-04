import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VALIDADE_MS, assinaturaDaReceita, estadoVazio, lerEstado, primeiroPendente } from '../src/lib/cozinha.ts';

const totais = { ingredientes: 4, passos: 5 };
const assinatura = assinaturaDaReceita(['Alho', 'Azeite'], ['Doure o alho.', 'Sirva.']);
const agora = 1_800_000_000_000;

const salvo = (mudancas: object) =>
  JSON.stringify({ ...estadoVazio(assinatura, agora - 1000), ingredientes: [0, 2], passos: [1], atual: 2, modo: true, ...mudancas });

test('a assinatura muda quando a receita muda', () => {
  assert.equal(assinatura, assinaturaDaReceita(['Alho', 'Azeite'], ['Doure o alho.', 'Sirva.']));
  assert.notEqual(assinatura, assinaturaDaReceita(['Alho', 'Azeite', 'Sal'], ['Doure o alho.', 'Sirva.']));
  assert.notEqual(assinatura, assinaturaDaReceita(['Alho'], ['Azeite', 'Doure o alho.', 'Sirva.']));
});

test('recupera as marcações salvas', () => {
  const estado = lerEstado(salvo({}), assinatura, agora, totais);
  assert.deepEqual(estado.ingredientes, [0, 2]);
  assert.deepEqual(estado.passos, [1]);
  assert.equal(estado.atual, 2);
  assert.equal(estado.modo, true);
});

test('nada salvo, JSON quebrado ou formato estranho viram estado vazio', () => {
  for (const bruto of [null, '', '{', 'null', '42', '"oi"', '{"v":2}']) {
    const estado = lerEstado(bruto, assinatura, agora, totais);
    assert.deepEqual(estado, estadoVazio(assinatura, agora), String(bruto));
  }
});

test('receita alterada desde a última vez: começa do zero', () => {
  const estado = lerEstado(salvo({ assinatura: 'outra' }), assinatura, agora, totais);
  assert.deepEqual(estado.passos, []);
  assert.equal(estado.modo, false);
});

test('marcações de outro dia expiram', () => {
  const velho = salvo({ atualizadoEm: agora - VALIDADE_MS - 1 });
  assert.deepEqual(lerEstado(velho, assinatura, agora, totais).ingredientes, []);
  const recente = salvo({ atualizadoEm: agora - VALIDADE_MS + 60_000 });
  assert.deepEqual(lerEstado(recente, assinatura, agora, totais).ingredientes, [0, 2]);
});

test('índices fora da receita, repetidos ou inválidos são descartados', () => {
  const estado = lerEstado(
    salvo({ ingredientes: [3, 3, 9, -1, 1.5, 'x', 0], passos: [4, 5], atual: 99 }),
    assinatura,
    agora,
    totais,
  );
  assert.deepEqual(estado.ingredientes, [0, 3]);
  assert.deepEqual(estado.passos, [4]);
  assert.equal(estado.atual, 4, 'o passo atual fica dentro da receita');
});

test('primeiro passo pendente', () => {
  assert.equal(primeiroPendente([], 5), 0);
  assert.equal(primeiroPendente([0, 1], 5), 2);
  assert.equal(primeiroPendente([0, 2], 5, 2), 3, 'procura para a frente a partir do atual');
  assert.equal(primeiroPendente([2, 3, 4], 5, 3), 0, 'e volta ao começo se só faltar lá atrás');
  assert.equal(primeiroPendente([0, 1, 2, 3, 4], 5), 4, 'tudo feito: fica no último');
});
