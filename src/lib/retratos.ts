/**
 * Retratos do Esgabilado para o perfil de quem escreve no Caderno.
 * Cada retrato é um busto do ratinho, de perfil, em SVG no sistema 100×100,
 * pensado para caber num círculo. O traço e as folhas recebem as cores por
 * `style`, como em simbolos.ts, para seguir o tema (claro ou escuro).
 *
 * Os ids precisam bater com a regra da coluna perfis.retrato
 * (supabase/migrations/0002_retrato_do_perfil.sql); tests/retratos.test.ts confere.
 */

export const RETRATO_VIEWBOX = '0 0 100 100';

// ---------- Peças da cabeça (traço) ----------

const ORELHA = `<circle cx="40" cy="30" r="13"/><path d="M34 30 C 36 25 43 24 46 29"/>`;
const COSTAS = `<path d="M31 40 C 20 52 15 76 19 112"/>`;
const TOPO = `<path d="M52 35 C 62 38 70 45 75 51 C 78 54 80 57 81 59"/>`;
const QUEIXO = `<path d="M80 62 C 71 67 58 68 47 67 C 44 67 41 66 39 65"/>`;
const PEITO = `<path d="M39 65 C 48 76 53 92 51 112"/>`;
const BIGODES = `<path d="M82 58 L 95 53"/><path d="M83 61 L 97 61"/><path d="M82 63 L 94 69"/>`;
const NARIZ = (cor: string) => `<circle cx="81.5" cy="60.5" r="2.8" style="fill:${cor}" stroke="none"/>`;

const OLHO = {
  aberto: (cor: string) => `<circle cx="62" cy="48" r="2.4" style="fill:${cor}" stroke="none"/>`,
  feliz: () => `<path d="M58 50 C 60 45.5 64 45.5 66 50"/>`,
  dormindo: () => `<path d="M58 47 C 60 51 64 51 66 47"/>`,
  curioso: (cor: string) =>
    `<circle cx="62" cy="48" r="4.2"/><circle cx="63" cy="48" r="1.8" style="fill:${cor}" stroke="none"/><path d="M56 40 C 59 37 64 37 67 39"/>`,
};

type Olho = keyof typeof OLHO;

interface Desenho {
  /** Traços em azul-marinho (cor de destaque). */
  traco: string;
  /** Traços em manjericão (cor de rótulo): folhas, vapor, detalhes. */
  folha?: string;
}

/** Cabeça completa de perfil, com o olho escolhido e as peças a omitir. */
function cabeca(cor: string, olho: Olho, { semOrelha = false, semCorpo = false } = {}): string {
  return [
    semOrelha ? '' : ORELHA,
    semCorpo ? '' : COSTAS,
    TOPO,
    QUEIXO,
    semCorpo ? '' : PEITO,
    BIGODES,
    NARIZ(cor),
    OLHO[olho](cor),
  ].join('');
}

// ---------- Os dez retratos ----------

const DESENHOS = {
  classico: {
    nome: 'Clássico',
    descricao: 'O Esgabilado de perfil, atento',
    desenho: (t: string): Desenho => ({
      traco: cabeca(t, 'aberto'),
      folha: `<path d="M24 92 L 34 80"/><path d="M29 86 C 23 85 21 80 22 76 C 27 77 30 81 29 86"/><path d="M31 83 C 36 81 39 77 39 72 C 35 73 32 77 31 83"/>`,
    }),
  },
  chef: {
    nome: 'Chef',
    descricao: 'O Esgabilado com chapéu de cozinheiro',
    desenho: (t: string): Desenho => ({
      traco:
        cabeca(t, 'aberto', { semOrelha: true }) +
        `<path d="M33 38 C 34 42 36 44 38 45"/>` +
        `<path d="M36 33 L 62 40"/><path d="M37 26 L 63 33"/><path d="M36 33 L 37 26"/><path d="M62 40 L 63 33"/>` +
        `<path d="M37 26 C 28 22 28 10 38 9 C 40 2 52 1 55 8 C 62 4 72 11 68 19 C 72 24 68 32 63 33"/>`,
      folha: `<path d="M45 22 C 46 17 50 15 54 16"/>`,
    }),
  },
  provando: {
    nome: 'Provando',
    descricao: 'O Esgabilado provando o molho na colher de pau, de olhos fechados',
    desenho: (t: string): Desenho => ({
      traco:
        cabeca(t, 'feliz') +
        `<path d="M74 70 C 76 64 86 63 89 68 C 91 72 86 76 80 76 C 76 76 73 74 74 70 Z"/>` +
        `<path d="M86 75 L 96 104"/><path d="M90 74 L 100 102"/>` +
        `<path d="M84 96 C 88 92 94 92 98 96"/>`,
      folha: `<path d="M68 22 C 64 26 70 29 66 34"/><path d="M78 18 C 74 23 80 26 76 31"/>`,
    }),
  },
  queijo: {
    nome: 'Queijo',
    descricao: 'O Esgabilado abraçado a uma fatia de queijo',
    desenho: (t: string): Desenho => ({
      traco:
        cabeca(t, 'feliz') +
        `<path d="M52 82 L 72 72 L 94 82 Z"/><path d="M52 82 L 52 96 L 94 96 L 94 82"/>` +
        `<circle cx="61" cy="89" r="2.4"/><circle cx="77" cy="90" r="3.2"/><circle cx="88" cy="88" r="1.8"/><circle cx="72" cy="78" r="1.6"/>` +
        `<path d="M44 80 C 48 82 52 84 56 84"/>`,
      folha: `<path d="M60 24 L 63 30"/><path d="M70 22 L 70 29"/><path d="M80 24 L 77 30"/>`,
    }),
  },
  manjericao: {
    nome: 'Manjericão',
    descricao: 'O Esgabilado cheirando um raminho de manjericão',
    desenho: (t: string): Desenho => ({
      traco: cabeca(t, 'feliz') + `<path d="M72 102 C 74 96 80 94 84 96"/>`,
      folha:
        `<path d="M78 108 L 88 74"/>` +
        `<path d="M84 85 C 76 84 72 77 73 71 C 80 73 84 79 84 85"/>` +
        `<path d="M86 79 C 93 76 97 70 97 64 C 91 66 87 72 86 79"/>` +
        `<path d="M88 74 C 85 68 86 63 90 60"/>`,
    }),
  },
  curioso: {
    nome: 'Curioso',
    descricao: 'O Esgabilado curioso, de olho arregalado e sobrancelha erguida',
    desenho: (t: string): Desenho => ({
      traco: cabeca(t, 'curioso') + `<path d="M82 18 C 82 12 92 12 92 18 C 92 23 87 23 87 28"/><circle cx="87" cy="34" r="1.6" style="fill:${t}" stroke="none"/>`,
      folha: `<path d="M24 92 L 34 80"/><path d="M29 86 C 23 85 21 80 22 76 C 27 77 30 81 29 86"/>`,
    }),
  },
  mesa: {
    nome: 'À mesa',
    descricao: 'O Esgabilado de guardanapo no pescoço e garfo na mão',
    desenho: (t: string): Desenho => ({
      traco:
        cabeca(t, 'aberto') +
        `<path d="M84 110 L 90 88"/><path d="M85 80 L 87 74"/><path d="M89 81 L 91 75"/><path d="M93 82 L 95 76"/><path d="M84 79 C 85 86 92 88 94 82"/>` +
        `<path d="M76 104 C 80 98 86 96 90 98"/>`,
      folha: `<path d="M40 67 L 66 69 L 52 92 Z"/><path d="M40 67 C 36 63 34 61 35 58"/><path d="M40 67 C 36 70 33 70 31 68"/>`,
    }),
  },
  soneca: {
    nome: 'Soneca',
    descricao: 'O Esgabilado cochilando depois do almoço',
    desenho: (t: string): Desenho => ({
      traco: cabeca(t, 'dormindo'),
      folha: `<path d="M66 20 L 74 20 L 66 28 L 74 28"/><path d="M80 8 L 86 8 L 80 14 L 86 14"/><path d="M58 30 L 62 30 L 58 34 L 62 34"/>`,
    }),
  },
  espaguete: {
    nome: 'Espaguete',
    descricao: 'O Esgabilado sorvendo um fio de espaguete',
    desenho: (t: string): Desenho => ({
      traco:
        cabeca(t, 'feliz') +
        `<path d="M76 64 C 70 72 82 76 76 84 C 70 92 82 96 78 112"/>` +
        `<path d="M72 65 C 64 74 74 80 68 88 C 62 96 70 100 68 112"/>`,
      folha: `<path d="M74 20 C 70 25 76 28 72 33"/><path d="M86 24 C 82 29 88 32 84 37"/>`,
    }),
  },
  panela: {
    nome: 'Na panela',
    descricao: 'O Esgabilado espiando de dentro de uma panela fumegante',
    desenho: (t: string): Desenho => ({
      traco:
        cabeca(t, 'aberto', { semCorpo: true }) +
        `<path d="M31 40 C 25 48 22 58 22 70"/><path d="M39 65 C 42 68 44 70 45 70"/>` +
        `<path d="M8 70 L 92 70"/><path d="M14 70 L 18 112"/><path d="M86 70 L 82 112"/>` +
        `<path d="M6 78 L 15 78"/><path d="M85 78 L 94 78"/>`,
      folha: `<path d="M74 18 C 70 23 76 26 72 31"/><path d="M86 22 C 82 27 88 30 84 35"/>`,
    }),
  },
} as const;

export type IdRetrato = keyof typeof DESENHOS;

export const IDS_RETRATO = Object.keys(DESENHOS) as IdRetrato[];

export function ehRetrato(valor: unknown): valor is IdRetrato {
  return typeof valor === 'string' && Object.hasOwn(DESENHOS, valor);
}

export function infoRetrato(id: IdRetrato): { nome: string; descricao: string } {
  const { nome, descricao } = DESENHOS[id];
  return { nome, descricao };
}

/** Conteúdo do <svg> (sem a tag) de um retrato, com as cores dadas. */
export function tracosRetrato(id: IdRetrato, traco: string, folha: string): string {
  const desenho = DESENHOS[id].desenho(traco);
  return `
  <g transform="translate(5 9) scale(0.84)">
    <g style="stroke:${traco}" stroke-width="3.5">${desenho.traco}</g>
    ${desenho.folha ? `<g style="stroke:${folha}" stroke-width="3">${desenho.folha}</g>` : ''}
  </g>`;
}
