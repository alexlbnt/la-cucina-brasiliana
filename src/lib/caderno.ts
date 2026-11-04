/** Tipos e regras do Caderno da cozinha, espelhando supabase/migrations/. */

export type Papel = 'leitor' | 'admin';
export type StatusPublicacao = 'pendente' | 'aprovada' | 'recusada';

export interface Perfil {
  id: string;
  nome: string;
  papel: Papel;
  /** Id de um desenho de src/lib/retratos.ts; null mostra as iniciais. */
  retrato: string | null;
}

export interface Autor {
  nome: string;
  papel: Papel;
  retrato: string | null;
}

export interface Publicacao {
  id: string;
  autor_id: string;
  titulo: string;
  texto: string;
  prato_slug: string | null;
  status: StatusPublicacao;
  criada_em: string;
  publicada_em: string | null;
  editada_em: string | null;
  autor: Autor | null;
}

export interface PublicacaoNoMural extends Publicacao {
  opinioes: { count: number }[];
}

export interface Opiniao {
  id: string;
  publicacao_id: string;
  autor_id: string;
  texto: string;
  oculta: boolean;
  criada_em: string;
  autor: Autor | null;
}

/** Limites iguais aos do banco, para avisar antes de enviar. */
export const LIMITES = {
  titulo: { min: 3, max: 120 },
  texto: { min: 10, max: 5000 },
  opiniao: { min: 2, max: 1000 },
  nome: { min: 1, max: 80 },
} as const;

export const POR_PAGINA = 10;

/** Confere título e texto de uma publicação; devolve a mensagem de erro ou ''. */
export function validarPublicacao(titulo: string, texto: string): string {
  if (titulo.length < LIMITES.titulo.min || titulo.length > LIMITES.titulo.max) {
    return `O título precisa ter entre ${LIMITES.titulo.min} e ${LIMITES.titulo.max} caracteres.`;
  }
  if (texto.length < LIMITES.texto.min || texto.length > LIMITES.texto.max) {
    return `O texto precisa ter entre ${LIMITES.texto.min} e ${LIMITES.texto.max} caracteres.`;
  }
  return '';
}

/**
 * Colunas usadas no mural e na página da publicação. Com `autorObrigatorio`,
 * o autor vira inner join, para filtrar pelo papel de quem escreveu.
 */
export function colunasPublicacao({ autorObrigatorio = false, comOpinioes = false } = {}): string {
  const autor = `autor:perfis${autorObrigatorio ? '!inner' : ''}(nome, papel, retrato)`;
  const opinioes = comOpinioes ? ', opinioes(count)' : '';
  return `id, autor_id, titulo, texto, prato_slug, status, criada_em, publicada_em, editada_em, ${autor}${opinioes}`;
}

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

export function formatarData(iso: string): string {
  return formatoData.format(new Date(iso));
}

/** Traduz os erros do banco para mensagens de gente. */
export function mensagemDeErro(erro: { message?: string } | null | undefined): string {
  const texto = erro?.message ?? '';
  if (texto.includes('limite_diario')) {
    return 'Você chegou ao limite de envios de hoje. Volte amanhã!';
  }
  if (texto.includes('publicacao_nao_encontrada')) {
    return 'Essa publicação não existe mais ou não é sua.';
  }
  if (texto.includes('row-level security')) {
    return 'Você não tem permissão para fazer isso.';
  }
  if (texto.includes('check constraint')) {
    return 'Confira o tamanho do texto e tente de novo.';
  }
  if (texto.includes('duplicate key')) {
    return 'Isso já foi registrado.';
  }
  return 'Algo deu errado do nosso lado. Tente de novo em instantes.';
}

/** Só aceita caminhos internos como destino depois do login. */
export function destinoSeguro(valor: string | null | undefined, padrao = '/'): string {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) {
    return padrao;
  }
  return valor;
}

/** Iniciais para o monograma no lugar da foto da conta Google (que não carregamos). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  return letras.map((p) => p[0]!.toLocaleUpperCase('pt-BR')).join('') || '?';
}
