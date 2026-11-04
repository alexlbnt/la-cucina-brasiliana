import type { APIRoute } from 'astro';
import { listarReceitas, urlDaReceita } from '../lib/receitas';

/**
 * Service worker, gerado no build (vira /sw.js) para já saber quais receitas existem.
 *
 * - Cardápio, receitas e Sobre: guardados na instalação. Rede primeiro (para ver
 *   sempre a versão nova); sem rede, ou com rede lenta demais, abre o que está guardado.
 * - Páginas do Caderno e da conta: nunca guardadas (são pessoais e mudam o tempo todo).
 *   Sem rede, mostram a página /offline.
 * - /api/*: passa direto.
 * - Arquivos do build (/_astro/, com hash no nome): guardados para sempre.
 * - Fontes do Google: guardadas e atualizadas em segundo plano.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const receitas = await listarReceitas();
  const paginas = ['/offline', '/cardapio', '/sobre', ...receitas.map(urlDaReceita)];
  const arquivos = ['/manifest.webmanifest', '/favicon.svg', '/favicon.png', '/icone-192.png'];
  // Muda a cada build: o navegador percebe o sw.js novo e renova o que guardou.
  const versao = Date.now().toString(36);

  const codigo = `// Gerado em src/pages/sw.js.ts
const VERSAO = ${JSON.stringify(versao)};
const PAGINAS = ${JSON.stringify(paginas)};
const ARQUIVOS = ${JSON.stringify(arquivos)};
const CACHE_PAGINAS = 'paginas-' + VERSAO;
const CACHE_ARQUIVOS = 'arquivos-' + VERSAO;
const CACHE_FONTES = 'fontes-v1';
const ESPERA_REDE_MS = 3500;

const ESTATICAS = new Set(PAGINAS);
const ehEstatica = (caminho) => ESTATICAS.has(caminho) || caminho.startsWith('/receitas/');
const normalizar = (url) => (url.pathname.length > 1 ? url.pathname.replace(/\\/+$/, '') : url.pathname);

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const paginas = await caches.open(CACHE_PAGINAS);
      const doBuild = new Set(ARQUIVOS);
      const fontes = new Set();
      await Promise.allSettled(
        PAGINAS.map(async (caminho) => {
          const resposta = await fetch(caminho, { cache: 'reload' });
          if (!resposta.ok || resposta.redirected) return;
          await paginas.put(caminho, resposta.clone());
          // CSS, scripts e imagens que a página usa (inclusive as máscaras do
          // Esgabilado, dentro de style=""), para ela abrir inteira sem rede.
          const html = await resposta.text();
          for (const [arquivo] of html.matchAll(/\\/_astro\\/[\\w.@~-]+/g)) doBuild.add(arquivo);
          for (const [folha] of html.matchAll(/https:\\/\\/fonts\\.googleapis\\.com\\/css2\\?[^"]+/g)) {
            fontes.add(folha.replaceAll('&amp;', '&'));
          }
        }),
      );
      const arquivos = await caches.open(CACHE_ARQUIVOS);
      // Os scripts importam pedaços compartilhados (./sessao.xyz.js) que o HTML não cita:
      // segue os imports até não aparecer nada novo.
      let pendentes = [...doBuild];
      while (pendentes.length > 0) {
        const novos = [];
        await Promise.allSettled(
          pendentes.map(async (arquivo) => {
            const resposta = await fetch(arquivo);
            if (!resposta.ok) return;
            await arquivos.put(arquivo, resposta.clone());
            if (!arquivo.endsWith('.js')) return;
            const js = await resposta.text();
            for (const [, nome] of js.matchAll(/(?:from|import)\\s*\\(?\\s*"\\.\\/([\\w.@~-]+\\.js)"/g)) {
              const caminho = '/_astro/' + nome;
              if (!doBuild.has(caminho)) {
                doBuild.add(caminho);
                novos.push(caminho);
              }
            }
          }),
        );
        pendentes = novos;
      }
      await Promise.allSettled([...fontes].map(guardarFontes));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const manter = new Set([CACHE_PAGINAS, CACHE_ARQUIVOS, CACHE_FONTES]);
      for (const nome of await caches.keys()) if (!manter.has(nome)) await caches.delete(nome);
      await self.clients.claim();
    })(),
  );
});

// A folha de estilos do Google Fonts e os arquivos de fonte que ela cita.
async function guardarFontes(folha) {
  const cache = await caches.open(CACHE_FONTES);
  const resposta = await fetch(folha, { mode: 'cors' });
  if (!resposta.ok) return;
  await cache.put(folha, resposta.clone());
  const css = await resposta.text();
  const arquivos = [...css.matchAll(/url\\((https:\\/\\/fonts\\.gstatic\\.com\\/[^)]+)\\)/g)].map(([, url]) => url);
  await Promise.allSettled(arquivos.map((url) => cache.add(new Request(url, { mode: 'cors' }))));
}

async function redePrimeiro(pedido, chave) {
  const cache = await caches.open(CACHE_PAGINAS);
  const daRede = fetch(pedido).then((resposta) => {
    if (resposta.ok && !resposta.redirected) cache.put(chave, resposta.clone());
    return resposta;
  });
  const guardada = await cache.match(chave);
  if (!guardada) {
    return daRede.catch(async () => (await caches.match('/offline')) ?? Response.error());
  }
  // Com algo guardado: espera a rede só um pouco (Wi-Fi da cozinha é traiçoeiro).
  const espera = new Promise((resolver) => setTimeout(() => resolver(guardada), ESPERA_REDE_MS));
  return Promise.race([daRede.catch(() => guardada), espera]);
}

async function guardadoPrimeiro(pedido, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const resposta = await fetch(pedido);
  if (resposta.ok || resposta.type === 'opaque') cache.put(pedido, resposta.clone());
  return resposta;
}

async function guardadoEAtualiza(pedido, nomeCache) {
  const cache = await caches.open(nomeCache);
  // ignoreVary: o Google Fonts varia a resposta por cabeçalhos que mudam entre pedidos.
  const guardada = await cache.match(pedido, { ignoreVary: true });
  const daRede = fetch(pedido)
    .then((resposta) => {
      if (resposta.ok || resposta.type === 'opaque') cache.put(pedido, resposta.clone());
      return resposta;
    })
    .catch(() => guardada ?? Response.error());
  return guardada ?? daRede;
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    evento.respondWith(guardadoEAtualiza(pedido, CACHE_FONTES));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (pedido.mode === 'navigate') {
    const caminho = normalizar(url);
    if (ehEstatica(caminho)) {
      evento.respondWith(redePrimeiro(pedido, caminho));
    } else {
      evento.respondWith(fetch(pedido).catch(async () => (await caches.match('/offline')) ?? Response.error()));
    }
    return;
  }

  if (url.pathname.startsWith('/_astro/')) {
    evento.respondWith(guardadoPrimeiro(pedido, CACHE_ARQUIVOS));
  } else if (ARQUIVOS.includes(url.pathname)) {
    evento.respondWith(guardadoEAtualiza(pedido, CACHE_ARQUIVOS));
  }
});
`;

  return new Response(codigo, {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
  });
};
