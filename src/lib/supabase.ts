import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from 'astro:env/server';

/** O Caderno só funciona com as variáveis do Supabase definidas. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Cliente do Supabase para uma requisição: fala com o banco como a pessoa
 * logada (cookie de sessão) ou como anônima. Nunca usa a chave de serviço.
 */
export function criarSupabase(request: Request, cookies: AstroCookies): SupabaseClient {
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesParaGravar) {
        for (const { name, value, options } of cookiesParaGravar) {
          cookies.set(name, value, {
            ...options,
            sameSite: options.sameSite === true ? 'strict' : options.sameSite || 'lax',
          });
        }
      },
    },
  });
}
