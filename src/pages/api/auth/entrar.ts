import type { APIRoute } from 'astro';
import { destinoSeguro } from '../../../lib/caderno';

export const prerender = false;

/** Começa o login com Google e manda a pessoa para a tela de consentimento. */
export const POST: APIRoute = async ({ locals, request, url, redirect }) => {
  if (!locals.supabase) return redirect('/entrar?erro=indisponivel', 303);

  const formulario = await request.formData();
  const proximo = destinoSeguro(String(formulario.get('proximo') ?? ''));
  const retorno = new URL('/api/auth/retorno', url.origin);
  retorno.searchParams.set('proximo', proximo);

  const { data, error } = await locals.supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: retorno.toString() },
  });

  if (error || !data.url) return redirect('/entrar?erro=google', 303);
  return redirect(data.url, 303);
};
