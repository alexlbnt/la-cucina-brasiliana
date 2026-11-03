/**
 * Desenhos da casa em SVG, numa fonte única.
 * Usados pelos componentes (Ratinho, Raminho, Selo) e pelo script que gera
 * o favicon e a imagem Open Graph (scripts/gerar-imagens.mjs).
 *
 * As cores entram por `style` para aceitar tanto valores fixos (#1F2D4D)
 * quanto variáveis CSS (var(--cor-destaque)).
 */

export const CORES = {
  marinho: '#1F2D4D',
  manjericao: '#4A6B3A',
  creme: '#F6F0E4',
  manjericaoClaro: '#B9CDA8',
} as const;

export const RATINHO_VIEWBOX = '0 0 220 170';
export const RAMINHO_VIEWBOX = '0 0 40 22';
export const SELO_VIEWBOX = '0 0 400 400';

/** Traços do ratinho (sem a tag <svg>), no sistema de coordenadas 220×170. */
export function tracosRatinho(traco: string, raminho: string): string {
  return `
  <g style="stroke:${traco}" stroke-width="3">
    <path d="M58 150 C 38 138 38 104 62 84 C 80 68 108 62 128 68"/>
    <path d="M128 68 C 140 56 160 58 176 72 C 184 79 190 86 192 92 C 186 98 170 102 150 100 C 146 100 142 99 140 98"/>
    <path d="M146 100 C 158 116 156 140 138 150 L 58 150"/>
    <circle cx="146" cy="56" r="16"/>
    <path d="M140 52 C 142 46 150 44 154 50"/>
    <path d="M70 150 C 74 140 92 140 98 150"/>
    <path d="M58 150 C 30 156 12 148 14 132 C 16 118 32 116 36 126"/>
    <path d="M146 122 C 154 120 160 126 156 132"/>
    <path d="M186 94 L 208 86"/>
    <path d="M186 96 L 210 98"/>
    <path d="M184 98 L 204 108"/>
  </g>
  <circle cx="192" cy="92" r="3.5" style="fill:${traco}"/>
  <circle cx="166" cy="78" r="3" style="fill:${traco}"/>
  <g style="stroke:${raminho}" stroke-width="2.4">
    <path d="M154 132 L 172 106"/>
    <path d="M164 118 C 155 114 152 106 154 99 C 162 102 166 110 164 118"/>
    <path d="M167 113 C 175 110 181 104 183 97 C 176 98 170 104 167 113"/>
  </g>`;
}

/** Traços do raminho de manjericão, no sistema 40×22. */
export function tracosRaminho(cor: string): string {
  return `
  <g style="stroke:${cor}" stroke-width="1.6">
    <path d="M20 20 C 20 12, 20 8, 20 2"/>
    <path d="M20 12 C 12 12, 6 8, 3 3 C 10 3, 16 6, 20 12"/>
    <path d="M20 12 C 28 12, 34 8, 37 3 C 30 3, 24 6, 20 12"/>
  </g>`;
}

export const TEXTO_SELO = 'LA CUCINA BRASILIANA · BUON APPETITO ·';
export const RAIO_TEXTO_SELO = 148;

/**
 * Selo: círculo duplo, texto circular e o ratinho no centro (sistema 400×400).
 * `idCaminho` precisa ser único na página, porque o textPath referencia um id.
 * `textoEmContornos` substitui o <text> por contornos já desenhados, para quem
 * não carrega fontes (favicon e PNGs gerados por scripts/gerar-imagens.mjs).
 */
export function tracosSelo(
  traco: string,
  raminho: string,
  idCaminho: string,
  textoEmContornos?: string,
): string {
  // Círculo de raio 148 que começa embaixo e corre no sentido horário,
  // assim o texto, centralizado no caminho, fica centralizado no topo.
  const r = RAIO_TEXTO_SELO;
  const caminho = `M 200 ${200 + r} A ${r} ${r} 0 1 1 200 ${200 - r} A ${r} ${r} 0 1 1 200 ${200 + r}`;
  const texto = textoEmContornos
    ? `<g style="fill:${traco}">${textoEmContornos}</g>`
    : `<text style="fill:${traco}" font-family="'EB Garamond', Garamond, 'Times New Roman', serif" font-size="22" letter-spacing="5">
    <textPath href="#${idCaminho}" startOffset="50%" text-anchor="middle">${TEXTO_SELO}</textPath>
  </text>`;
  return `
  ${textoEmContornos ? '' : `<defs><path id="${idCaminho}" d="${caminho}"/></defs>`}
  <g style="stroke:${traco}" fill="none">
    <circle cx="200" cy="200" r="190" stroke-width="4"/>
    <circle cx="200" cy="200" r="180" stroke-width="1.5"/>
  </g>
  ${texto}
  <g transform="translate(103,124) scale(0.88)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${tracosRatinho(traco, raminho)}
  </g>`;
}
