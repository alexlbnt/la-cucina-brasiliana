import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIAS, type Categoria } from './categorias';

export type Receita = CollectionEntry<'receitas'>;

/** Todas as receitas, em ordem de número. Falha o build se dois pratos tiverem o mesmo número. */
export async function listarReceitas(): Promise<Receita[]> {
  const receitas = await getCollection('receitas');
  receitas.sort((a, b) => a.data.numero - b.data.numero);

  const vistos = new Map<number, string>();
  for (const receita of receitas) {
    const outra = vistos.get(receita.data.numero);
    if (outra) {
      throw new Error(
        `As receitas "${outra}" e "${receita.data.titulo}" usam o mesmo número (${receita.data.numero}).`,
      );
    }
    vistos.set(receita.data.numero, receita.data.titulo);
  }

  return receitas;
}

/** Receitas agrupadas nas seções do cardápio; seções vazias ficam de fora. */
export function agruparPorCategoria(receitas: Receita[]) {
  return CATEGORIAS.map((categoria: Categoria) => ({
    categoria,
    receitas: receitas.filter((receita) => receita.data.categoria === categoria),
  })).filter((secao) => secao.receitas.length > 0);
}

/** 1 → "01" */
export function formatarNumero(numero: number): string {
  return String(numero).padStart(2, '0');
}

export function urlDaReceita(receita: Receita): string {
  return `/receitas/${receita.id}`;
}
