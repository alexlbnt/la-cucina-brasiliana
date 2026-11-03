import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarTexto, resumir } from '../src/lib/texto.ts';
import { destinoSeguro, iniciais } from '../src/lib/caderno.ts';

test('escapa qualquer HTML antes de formatar', () => {
  assert.equal(
    formatarTexto('<script>alert("x")</script> <img src=x onerror=alert(1)>'),
    '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &lt;img src=x onerror=alert(1)&gt;</p>',
  );
  assert.equal(formatarTexto('**<b>oi</b>**'), '<p><strong>&lt;b&gt;oi&lt;/b&gt;</strong></p>');
});

test('parágrafos, quebras de linha, negrito e itálico', () => {
  assert.equal(
    formatarTexto('Fiz o **arroz** hoje.\nFicou *ótimo*.\n\nNo outro dia, _com limão_.'),
    '<p>Fiz o <strong>arroz</strong> hoje.<br />Ficou <em>ótimo</em>.</p>\n<p>No outro dia, <em>com limão</em>.</p>',
  );
});

test('não confunde asteriscos e sublinhados soltos com formatação', () => {
  assert.equal(formatarTexto('2 * 3 = 6 e nome_de_arquivo'), '<p>2 * 3 = 6 e nome_de_arquivo</p>');
});

test('resumo corta sem partir palavra e tira a formatação', () => {
  assert.equal(resumir('**Curto**'), 'Curto');
  assert.equal(resumir('uma frase com várias palavras', 15), 'uma frase com…');
});

test('destino depois do login só aceita caminhos internos', () => {
  assert.equal(destinoSeguro('/caderno/escrever'), '/caderno/escrever');
  assert.equal(destinoSeguro('https://golpe.com'), '/');
  assert.equal(destinoSeguro('//golpe.com'), '/');
  assert.equal(destinoSeguro('/\\golpe.com'), '/');
  assert.equal(destinoSeguro(null), '/');
});

test('iniciais do monograma', () => {
  assert.equal(iniciais('Ana Maria Souza'), 'AS');
  assert.equal(iniciais('beto'), 'B');
  assert.equal(iniciais('  '), '?');
});
