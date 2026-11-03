declare namespace App {
  interface Locals {
    /** Cliente do Supabase da requisição; null em páginas estáticas ou sem configuração. */
    supabase: import('@supabase/supabase-js').SupabaseClient | null;
    /** Perfil de quem está logado; null para visitantes. */
    perfil: import('./lib/caderno').Perfil | null;
  }
}
