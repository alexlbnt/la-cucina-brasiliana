/**
 * Gera em public/ as imagens derivadas do selo:
 *   favicon.svg          selo (com versão para modo escuro)
 *   favicon.png          64×64
 *   apple-touch-icon.png 180×180, sobre o creme
 *   og.png               1200×630, selo centralizado sobre o creme
 *   icone-*.png          ícones do app (192, 512 e 512 "maskable"), para o manifest
 *
 * Uso: npm run imagens  (só é preciso rodar de novo se o desenho mudar)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { CORES, RAIO_TEXTO_SELO, SELO_VIEWBOX, TEXTO_SELO, tracosSelo } from '../src/lib/simbolos.ts';

const publico = new URL('../public/', import.meta.url);
const caminho = (nome) => fileURLToPath(new URL(nome, publico));

/**
 * O sharp não desenha textPath nem carrega a EB Garamond, então o texto do selo
 * vira contornos aqui, com as mesmas regras do site: 22 px, letter-spacing 5,
 * raio 148, centralizado no topo.
 */
async function textoDoSeloEmContornos() {
  const arquivo = new URL(
    '../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff',
    import.meta.url,
  );
  const dados = await readFile(arquivo);
  const fonte = opentype.parse(dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength));

  const corpo = 22;
  const espacamento = 5;
  const escala = corpo / fonte.unitsPerEm;
  const glifos = fonte.stringToGlyphs(TEXTO_SELO);

  const avancos = glifos.map((glifo, i) => {
    const kerning = glifos[i + 1] ? fonte.getKerningValue(glifo, glifos[i + 1]) : 0;
    return (glifo.advanceWidth + kerning) * escala + espacamento;
  });
  const total = avancos.reduce((soma, a) => soma + a, 0);

  // O caminho começa embaixo e corre no sentido horário; o meio do texto fica
  // no meio do caminho (o topo), como startOffset="50%" + text-anchor="middle".
  const r = RAIO_TEXTO_SELO;
  let posicao = Math.PI * r - total / 2;

  return glifos
    .map((glifo, i) => {
      const largura = glifo.advanceWidth * escala;
      const meio = posicao + largura / 2;
      posicao += avancos[i];

      const angulo = Math.PI / 2 + meio / r;
      const x = 200 + r * Math.cos(angulo);
      const y = 200 + r * Math.sin(angulo);
      const giro = (angulo * 180) / Math.PI + 90;
      const d = glifo.getPath(-largura / 2, 0, corpo).toPathData(2);
      return d ? `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${giro.toFixed(2)})" d="${d}"/>` : '';
    })
    .join('');
}

const texto = await textoDoSeloEmContornos();

function seloSvg({ tamanho, traco = CORES.marinho, raminho = CORES.manjericao, estilo = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SELO_VIEWBOX}" width="${tamanho}" height="${tamanho}">${estilo}${tracosSelo(traco, raminho, 'selo-caminho', texto)}</svg>`;
}

// Favicon SVG: acompanha o modo claro/escuro do navegador.
const estiloFavicon = `<style>
  :root { --traco: ${CORES.marinho}; --raminho: ${CORES.manjericao}; }
  @media (prefers-color-scheme: dark) { :root { --traco: ${CORES.creme}; --raminho: ${CORES.manjericaoClaro}; } }
</style>`;
await writeFile(
  caminho('favicon.svg'),
  seloSvg({ tamanho: 400, traco: 'var(--traco)', raminho: 'var(--raminho)', estilo: estiloFavicon }) + '\n',
);

async function seloSobreCreme(largura, altura, tamanhoSelo) {
  const selo = await sharp(Buffer.from(seloSvg({ tamanho: tamanhoSelo }))).png().toBuffer();
  return sharp({
    create: { width: largura, height: altura, channels: 4, background: CORES.creme },
  })
    .composite([{ input: selo, gravity: 'center' }])
    .png({ compressionLevel: 9 });
}

await sharp(Buffer.from(seloSvg({ tamanho: 64 })))
  .png()
  .toFile(caminho('favicon.png'));

await (await seloSobreCreme(180, 180, 164)).toFile(caminho('apple-touch-icon.png'));
await (await seloSobreCreme(1200, 630, 520)).toFile(caminho('og.png'));

// Ícones do app (manifest.webmanifest). Os "maskable" deixam respiro para o
// recorte redondo ou arredondado que o Android aplica.
await (await seloSobreCreme(192, 192, 176)).toFile(caminho('icone-192.png'));
await (await seloSobreCreme(512, 512, 472)).toFile(caminho('icone-512.png'));
await (await seloSobreCreme(512, 512, 360)).toFile(caminho('icone-mascara-512.png'));

console.log(
  'Imagens geradas em public/: favicon.svg, favicon.png, apple-touch-icon.png, og.png, icone-192.png, icone-512.png, icone-mascara-512.png',
);
