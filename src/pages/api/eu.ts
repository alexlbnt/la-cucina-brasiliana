import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Quem está no navegador, para as páginas estáticas (que não sabem quem está logado):
 * nome, quantas opiniões novas chegaram e as receitas guardadas.
 */
export const GET: APIRoute = async ({ locals }) => {
  const { supabase, perfil } = locals;
  if (!supabase || !perfil) return Response.json({ conectado: false });

  const [novas, favoritos] = await Promise.all([
    supabase.rpc('opinioes_novas'),
    supabase.from('favoritos').select('prato_slug').order('criado_em', { ascending: false }),
  ]);

  return Response.json({
    conectado: true,
    nome: perfil.nome,
    novas: typeof novas.data === 'number' ? novas.data : 0,
    favoritos: ((favoritos.data ?? []) as { prato_slug: string }[]).map((f) => f.prato_slug),
  });
};
