-- ------------------------------------------------------------------
-- Publicação sem aprovação prévia: tudo o que é escrito vai direto para
-- o caderno. A moderação passa a ser depois: o admin apaga (ou recusa)
-- o que não seguir as regras, e o limite de 3 publicações por dia segue
-- valendo contra spam.
--
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run),
-- depois de 0003.
-- ------------------------------------------------------------------

-- Nasce aprovada. O gatilho aprovar_publicacao_de_admin já marca a data
-- de publicação de toda publicação que nasce aprovada.
alter table public.publicacoes alter column status set default 'aprovada';

-- O que estava esperando na fila entra no caderno agora
-- (o gatilho marcar_publicacao preenche publicada_em).
update public.publicacoes set status = 'aprovada' where status = 'pendente';

-- Editar não manda mais de volta para a aprovação: o status fica como está.
create or replace function public.editar_publicacao(
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

  if (atual.titulo, atual.texto, atual.prato_slug)
     is distinct from (novo_titulo, novo_texto, novo_prato_slug) then
    update public.publicacoes set
      titulo = novo_titulo,
      texto = novo_texto,
      prato_slug = novo_prato_slug,
      editada_em = now()
    where id = publicacao;
  end if;

  return atual.status;
end;
$$;
