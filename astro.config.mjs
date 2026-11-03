// @ts-check
import { defineConfig } from 'astro/config';

// Defina SITE_URL na Vercel (ex.: https://lacucinabrasiliana.vercel.app)
// para que os links absolutos da imagem Open Graph fiquem corretos.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://la-cucina-brasiliana.vercel.app',
  trailingSlash: 'ignore',
});
