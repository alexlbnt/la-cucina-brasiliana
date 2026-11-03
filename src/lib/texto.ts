/**
 * Formatação mínima e segura para o que as pessoas escrevem no Caderno:
 * escapa todo HTML e só então aplica parágrafos, quebras de linha,
 * **negrito** e *itálico*. Links não viram links, de propósito (spam).
 */

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function enfeitar(linha: string): string {
  return linha
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1<em>$2</em>');
}

export function formatarTexto(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map((paragrafo) => `<p>${paragrafo.split('\n').map((l) => enfeitar(escapar(l))).join('<br />')}</p>`)
    .join('\n');
}

/** Texto corrido, sem formatação, cortado em ~`limite` caracteres sem partir palavra. */
export function resumir(texto: string, limite = 240): string {
  const corrido = texto.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
  if (corrido.length <= limite) return corrido;
  const corte = corrido.slice(0, limite);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,.;:!?-]+$/, '')}…`;
}
