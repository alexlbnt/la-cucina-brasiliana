import { defineMiddleware } from 'astro:middleware';
import type { Perfil } from './lib/caderno';
import { criarSupabase, supabaseConfigurado } from './lib/supabase';

/**
 * Nas páginas do Caderno (renderizadas na hora), identifica quem está logado.
 * Páginas estáticas (cardápio, receitas, sobre) passam direto.
 */
export const onRequest = defineMiddleware(async (contexto, proximo) => {
  contexto.locals.supabase = null;
  contexto.locals.perfil = null;

  if (contexto.isPrerendered || !supabaseConfigurado) {
    return proximo();
  }

  const supabase = criarSupabase(contexto.request, contexto.cookies);
  contexto.locals.supabase = supabase;

  // getUser confere a sessão no servidor de autenticação (não confia só no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase.from('perfis').select('id, nome, papel, retrato').eq('id', user.id).maybeSingle();
    contexto.locals.perfil = (data as Perfil | null) ?? null;
  }

  const resposta = await proximo();
  // Páginas com sessão nunca devem ficar em cache compartilhado.
  resposta.headers.set('Cache-Control', 'private, no-store');
  return resposta;
});
