-- ------------------------------------------------------------------
-- Editar publicação: quem escreveu pode corrigir título, texto e prato.
--
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run),
-- depois de 0002 e ANTES de publicar a versão do site que edita publicações.
--
-- A edição passa por uma função, não por permissão na tabela: assim o
-- leitor continua sem poder mexer no status, e a regra fica num lugar só.
-- Publicação de leitor editada volta para a aprovação (senão bastaria
-- publicar algo inocente e trocar o texto depois de aprovado).
-- Publicação do admin continua como está.
-- ------------------------------------------------------------------

alter table public.publicacoes add column editada_em timestamptz;

comment on column public.publicacoes.editada_em is 'Última vez que quem escreveu mudou título, texto ou prato.';

-- Devolve o status depois da edição ('aprovada' ou 'pendente').
create function public.editar_publicacao(
  publicacao uuid,
  novo_titulo text,
  novo_texto text,
  novo_prato_slug text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual public.publicacoes;
  admin boolean := public.eh_admin();
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  select * into atual from public.publicacoes
    where id = publicacao and autor_id = auth.uid()
    for update;
  if not found then
    raise exception 'publicacao_nao_encontrada';
  end if;

  -- Nada mudou: não mexe em nada, nem manda de volta para a aprovação.
  if (atual.titulo, atual.texto, atual.prato_slug)
     is not distinct from (novo_titulo, novo_texto, novo_prato_slug) then
    return atual.status;
  end if;

  update public.publicacoes set
    titulo = novo_titulo,
    texto = novo_texto,
    prato_slug = novo_prato_slug,
    editada_em = now(),
    status = case when admin then status else 'pendente' end,
    publicada_em = case when admin then publicada_em else null end
  where id = publicacao;

  return case when admin then atual.status else 'pendente' end;
end;
$$;

revoke execute on function public.editar_publicacao(uuid, text, text, text) from public, anon;
grant execute on function public.editar_publicacao(uuid, text, text, text) to authenticated;
