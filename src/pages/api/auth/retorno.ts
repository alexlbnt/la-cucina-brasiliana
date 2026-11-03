import type { APIRoute } from 'astro';
import { destinoSeguro } from '../../../lib/caderno';

export const prerender = false;

/** O Google devolve a pessoa aqui; trocamos o código pela sessão. */
export const GET: APIRoute = async ({ locals, url, redirect }) => {
  const codigo = url.searchParams.get('code');
  const proximo = destinoSeguro(url.searchParams.get('proximo'));

  if (!locals.supabase || !codigo) return redirect('/entrar?erro=google', 303);

  const { error } = await locals.supabase.auth.exchangeCodeForSession(codigo);
  if (error) return redirect('/entrar?erro=google', 303);

  return redirect(proximo, 303);
};
