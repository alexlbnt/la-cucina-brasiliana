/**
 * Receitas guardadas. Com conta, ficam no banco (valem em qualquer aparelho);
 * sem conta, ficam neste navegador. Ao entrar, as do navegador vão para a conta.
 */
import { atualizarSessaoConhecida, buscarSessao, gravarLocal, lerLocal } from './sessao';

const CHAVE_LOCAL = 'guardadas';
export const EVENTO_GUARDADAS = 'guardadas:mudou';

export interface Guardadas {
  slugs: string[];
  naConta: boolean;
}

function doNavegador(): string[] {
  const lista = lerLocal<unknown>(CHAVE_LOCAL);
  return Array.isArray(lista) ? lista.filter((s): s is string => typeof s === 'string') : [];
}

async function enviar(corpo: object): Promise<string[]> {
  const resposta = await fetch('/api/favoritos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(`favoritos: ${resposta.status}`);
  const { favoritos } = (await resposta.json()) as { favoritos: string[] };
  atualizarSessaoConhecida({ favoritos });
  return favoritos;
}

export async function listarGuardadas(): Promise<Guardadas> {
  const sessao = await buscarSessao();
  const locais = doNavegador();
  if (!sessao.conectado) return { slugs: locais, naConta: false };

  if (locais.length > 0) {
    try {
      const favoritos = await enviar({ juntar: locais });
      gravarLocal(CHAVE_LOCAL, null);
      return { slugs: favoritos, naConta: true };
    } catch {
      // Tenta de novo na próxima página; enquanto isso, mostra as duas listas juntas.
      return { slugs: [...new Set([...(sessao.favoritos ?? []), ...locais])], naConta: true };
    }
  }
  return { slugs: sessao.favoritos ?? [], naConta: true };
}

/** Guarda ou tira. Lança erro se a conta não puder ser atualizada (sem rede, por exemplo). */
export async function alternarGuardada(slug: string, guardar: boolean): Promise<Guardadas> {
  const sessao = await buscarSessao();
  let resultado: Guardadas;

  if (sessao.conectado) {
    resultado = { slugs: await enviar({ slug, guardar }), naConta: true };
  } else {
    const lista = doNavegador().filter((s) => s !== slug);
    if (guardar) lista.unshift(slug);
    gravarLocal(CHAVE_LOCAL, lista);
    resultado = { slugs: lista, naConta: false };
  }

  document.dispatchEvent(new CustomEvent<Guardadas>(EVENTO_GUARDADAS, { detail: resultado }));
  return resultado;
}
