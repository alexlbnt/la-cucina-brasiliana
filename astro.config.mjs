// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Defina SITE_URL na Vercel (ex.: https://lacucinabrasiliana.vercel.app)
// para que os links absolutos da imagem Open Graph fiquem corretos.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://la-cucina-brasiliana.vercel.app',
  trailingSlash: 'ignore',
  // Cardápio, receitas e Sobre continuam estáticos; só as páginas do
  // Caderno da cozinha (prerender = false) rodam como função na Vercel.
  adapter: vercel(),
  env: {
    schema: {
      // Sem essas duas, o site funciona e o Caderno avisa que ainda não foi ligado.
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
