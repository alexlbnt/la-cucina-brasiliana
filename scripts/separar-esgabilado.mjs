/**
 * Separa as artes do Esgabilado (arte/esgabilado/*.png, desenhadas sobre o creme)
 * em duas máscaras recortadas, em src/assets/esgabilado/:
 *   <cena>-traco.png  o traço azul-marinho
 *   <cena>-folha.png  as folhas e o vapor em manjericão
 *
 * Só a transparência importa: o site pinta cada máscara com a cor do tema, então
 * o desenho acompanha o modo escuro sem uma segunda versão.
 *
 * Uso: npm run esgabilado  (só é preciso rodar de novo se a arte mudar)
 */
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const origem = new URL('../arte/esgabilado/', import.meta.url);
const destino = new URL('../src/assets/esgabilado/', import.meta.url);

const FUNDO = [246, 240, 228];
const TINTAS = { traco: [31, 45, 77], folha: [74, 107, 58] };
const MARGEM = 12;

/**
 * Cada pixel é tratado como mistura do fundo com uma das tintas: fica com a tinta
 * que melhor explica a cor e com a opacidade dessa mistura (bordas suavizadas inclusas).
 */
function separar(dados, largura, altura) {
  const camadas = { traco: Buffer.alloc(largura * altura), folha: Buffer.alloc(largura * altura) };
  const vetores = Object.entries(TINTAS).map(([nome, tinta]) => {
    const v = tinta.map((c, i) => FUNDO[i] - c);
    return { nome, v, norma: v.reduce((s, x) => s + x * x, 0) };
  });
  let [x0, y0, x1, y1] = [largura, altura, -1, -1];

  for (let p = 0; p < largura * altura; p++) {
    const d = [0, 1, 2].map((i) => FUNDO[i] - dados[p * 3 + i]);
    if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) < 6) continue;

    let melhor = null;
    for (const { nome, v, norma } of vetores) {
      const a = Math.min(1, Math.max(0, (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / norma));
      const resto = d.reduce((s, x, i) => s + (x - a * v[i]) ** 2, 0);
      if (!melhor || resto < melhor.resto) melhor = { nome, a, resto };
    }
    camadas[melhor.nome][p] = Math.round(melhor.a * 255);

    const x = p % largura;
    const y = Math.floor(p / largura);
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }

  const recorte = {
    left: Math.max(0, x0 - MARGEM),
    top: Math.max(0, y0 - MARGEM),
    width: Math.min(largura, x1 + MARGEM + 1) - Math.max(0, x0 - MARGEM),
    height: Math.min(altura, y1 + MARGEM + 1) - Math.max(0, y0 - MARGEM),
  };
  return { camadas, recorte };
}

await mkdir(destino, { recursive: true });

for (const arquivo of (await readdir(origem)).filter((nome) => nome.endsWith('.png'))) {
  const cena = arquivo.replace(/\.png$/, '');
  const { data, info } = await sharp(fileURLToPath(new URL(arquivo, origem)))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { camadas, recorte } = separar(data, info.width, info.height);

  for (const [nome, alfa] of Object.entries(camadas)) {
    // Preto com a tinta no canal alfa: a cor real vem do CSS.
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let p = 0; p < alfa.length; p++) rgba[p * 4 + 3] = alfa[p];
    await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract(recorte)
      .png({ compressionLevel: 9 })
      .toFile(fileURLToPath(new URL(`${cena}-${nome}.png`, destino)));
  }
  console.log(`${cena}: ${recorte.width}×${recorte.height}`);
}
