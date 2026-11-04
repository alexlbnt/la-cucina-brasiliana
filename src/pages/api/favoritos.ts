import type { APIRoute } from 'astro';
import { listarReceitas } from '../../lib/receitas';

export const prerender = false;

const SO_CHAVE = { onConflict: 'perfil_id,prato_slug', ignoreDuplicates: true };

/**
 * Guarda ou tira uma receita da conta de quem está logado.
 *   { "slug": "pure-de-batata", "guardar": true }
 *   { "juntar": ["pure-de-batata", ...] }   (as guardadas no navegador antes de entrar)
 * Só aceita JSON da própria origem: um formulário de outro site não chega aqui.
 */
export const POST: APIRoute = async ({ locals, request, url }) => {
  const { supabase, perfil } = locals;
  if (!supabase || !perfil) return Response.json({ erro: 'nao_conectado' }, { status: 401 });

  const origem = request.headers.get('Origin');
  if (!request.headers.get('Content-Type')?.includes('application/json') || (origem && origem !== url.origin)) {
    return Response.json({ erro: 'pedido_invalido' }, { status: 400 });
  }

  let corpo: { slug?: unknown; guardar?: unknown; juntar?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'pedido_invalido' }, { status: 400 });
  }

  const existentes = new Set((await listarReceitas()).map((r) => r.id));
  let erro: unknown = null;

  if (Array.isArray(corpo.juntar)) {
    const slugs = [...new Set(corpo.juntar.filter((s): s is string => typeof s === 'string' && existentes.has(s)))];
    if (slugs.length > 0) {
      ({ error: erro } = await supabase.from('favoritos').upsert(
        slugs.map((prato_slug) => ({ prato_slug })),
        SO_CHAVE,
      ));
    }
  } else if (typeof corpo.slug === 'string' && existentes.has(corpo.slug) && typeof corpo.guardar === 'boolean') {
    ({ error: erro } = corpo.guardar
      ? await supabase.from('favoritos').upsert({ prato_slug: corpo.slug }, SO_CHAVE)
      : await supabase.from('favoritos').delete().eq('prato_slug', corpo.slug));
  } else {
    return Response.json({ erro: 'pedido_invalido' }, { status: 400 });
  }

  if (erro) return Response.json({ erro: 'falhou' }, { status: 500 });

  const { data } = await supabase.from('favoritos').select('prato_slug').order('criado_em', { ascending: false });
  return Response.json({ favoritos: ((data ?? []) as { prato_slug: string }[]).map((f) => f.prato_slug) });
};
