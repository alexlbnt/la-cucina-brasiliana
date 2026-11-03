import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIAS } from './lib/categorias';

const receitas = defineCollection({
  // O campo `slug` do frontmatter vira o endereço: /receitas/<slug>
  loader: glob({ pattern: '**/*.md', base: './src/content/receitas' }),
  schema: z.object({
    numero: z.number().int().positive(),
    titulo: z.string().min(1),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use só letras minúsculas sem acento, números e hífens.'),
    categoria: z.enum(CATEGORIAS),
    descricao: z.string().min(1),
    ingredientes: z.array(z.string().min(1)).min(1),
    preparo: z.array(z.string().min(1)).min(1),
    variacoes: z
      .array(
        z.object({
          texto: z.string().min(1),
          emTeste: z.boolean().default(false),
        }),
      )
      .optional(),
    // Caminho de uma imagem em public/ (ex.: /fotos/arroz.jpg). Vazio = espaço reservado.
    foto: z
      .string()
      .nullish()
      .transform((valor) => valor?.trim() || undefined),
  }),
});

export const collections = { receitas };
