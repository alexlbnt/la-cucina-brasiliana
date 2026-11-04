/**
 * Sessão vista do navegador. As páginas estáticas (cardápio, receitas) não sabem
 * quem está logado; perguntam a /api/eu, e só quando há cookie de sessão do
 * Supabase, para que visitantes não disparem nenhuma requisição.
 */

export interface Sessao {
  conectado: boolean;
  nome?: string;
  /** Opiniões novas nas publicações da pessoa. */
  novas?: number;
  /** Slugs das receitas guardadas na conta. */
  favoritos?: string[];
}

interface SessaoGuardada {
  sessao: Sessao;
  em: number;
}

const CHAVE = 'sessao';
const VALIDADE_MS = 30_000;
const DESCONECTADO: Sessao = { conectado: false };

let pedido: Promise<Sessao> | null = null;

export function lerLocal<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function gravarLocal(chave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
}

/** Cookie que o Supabase grava ao entrar (às vezes dividido em pedaços .0, .1...). */
export function temCookieDeSessao(): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}

/** O que já se sabe, sem esperar a rede (para o cabeçalho não piscar). */
export function sessaoConhecida(): Sessao {
  if (!temCookieDeSessao()) return DESCONECTADO;
  return lerLocal<SessaoGuardada>(CHAVE)?.sessao ?? DESCONECTADO;
}

export function atualizarSessaoConhecida(mudancas: Partial<Sessao>) {
  const atual = lerLocal<SessaoGuardada>(CHAVE);
  if (atual) gravarLocal(CHAVE, { ...atual, sessao: { ...atual.sessao, ...mudancas } });
}

/** Sessão confirmada pelo servidor (reaproveitada por 30 s, a não ser que `forcar`). */
export function buscarSessao({ forcar = false } = {}): Promise<Sessao> {
  if (!temCookieDeSessao()) {
    gravarLocal(CHAVE, null);
    return Promise.resolve(DESCONECTADO);
  }

  const guardada = lerLocal<SessaoGuardada>(CHAVE);
  if (!forcar && guardada && Date.now() - guardada.em < VALIDADE_MS) return Promise.resolve(guardada.sessao);

  pedido ??= fetch('/api/eu', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    .then((resposta) => (resposta.ok ? (resposta.json() as Promise<Sessao>) : Promise.reject(resposta.status)))
    .then((sessao) => {
      gravarLocal(CHAVE, { sessao, em: Date.now() });
      return sessao;
    })
    // Sem rede (ou servidor fora do ar): fica com o que já se sabia.
    .catch(() => guardada?.sessao ?? DESCONECTADO)
    .finally(() => {
      pedido = null;
    });
  return pedido;
}
