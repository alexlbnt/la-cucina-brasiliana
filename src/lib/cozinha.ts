/**
 * Regras do modo cozinha, sem tocar no navegador (para dar para testar).
 * O estado de cada receita fica no localStorage, na chave `cozinha:<slug>`.
 */

/** Depois disso sem mexer, as marcações são de outra vez que a pessoa cozinhou. */
export const VALIDADE_MS = 12 * 60 * 60 * 1000;

export interface EstadoCozinha {
  v: 1;
  /** Muda quando os ingredientes ou o preparo mudam; aí as marcações antigas não valem mais. */
  assinatura: string;
  ingredientes: number[];
  passos: number[];
  /** Passo mostrado no passo a passo. */
  atual: number;
  /** Se a pessoa estava no modo cozinha (para voltar nele ao recarregar a página). */
  modo: boolean;
  atualizadoEm: number;
}

/** Impressão digital curta do conteúdo da receita (djb2). */
export function assinaturaDaReceita(ingredientes: readonly string[], preparo: readonly string[]): string {
  const texto = `${ingredientes.join('\n')}\n--\n${preparo.join('\n')}`;
  let hash = 5381;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) + hash + texto.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function estadoVazio(assinatura: string, agora: number): EstadoCozinha {
  return { v: 1, assinatura, ingredientes: [], passos: [], atual: 0, modo: false, atualizadoEm: agora };
}

function indices(valor: unknown, total: number): number[] {
  if (!Array.isArray(valor)) return [];
  const validos = valor.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < total);
  return [...new Set(validos)].sort((a, b) => a - b);
}

/**
 * Lê o que estava salvo. Qualquer coisa estranha (JSON quebrado, receita que
 * mudou, marcações velhas) vira um estado vazio, nunca um erro.
 */
export function lerEstado(
  bruto: string | null,
  assinatura: string,
  agora: number,
  totais: { ingredientes: number; passos: number },
): EstadoCozinha {
  const vazio = estadoVazio(assinatura, agora);
  if (!bruto) return vazio;

  let salvo: Partial<EstadoCozinha>;
  try {
    salvo = JSON.parse(bruto);
  } catch {
    return vazio;
  }
  if (!salvo || typeof salvo !== 'object' || salvo.v !== 1 || salvo.assinatura !== assinatura) return vazio;

  const atualizadoEm = Number(salvo.atualizadoEm);
  if (!Number.isFinite(atualizadoEm) || agora - atualizadoEm > VALIDADE_MS || atualizadoEm > agora + 60_000) {
    return vazio;
  }

  const atual = Number.isInteger(salvo.atual) ? Math.min(Math.max(salvo.atual!, 0), totais.passos - 1) : 0;

  return {
    v: 1,
    assinatura,
    ingredientes: indices(salvo.ingredientes, totais.ingredientes),
    passos: indices(salvo.passos, totais.passos),
    atual: Math.max(atual, 0),
    modo: salvo.modo === true,
    atualizadoEm,
  };
}

/** Primeiro passo ainda não feito a partir de `inicio`; se todos estão feitos, o último. */
export function primeiroPendente(feitos: readonly number[], total: number, inicio = 0): number {
  const conjunto = new Set(feitos);
  for (let i = Math.max(inicio, 0); i < total; i++) {
    if (!conjunto.has(i)) return i;
  }
  for (let i = 0; i < Math.min(inicio, total); i++) {
    if (!conjunto.has(i)) return i;
  }
  return Math.max(total - 1, 0);
}

