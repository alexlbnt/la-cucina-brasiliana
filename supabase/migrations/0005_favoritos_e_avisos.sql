-- ------------------------------------------------------------------
-- Receitas guardadas e aviso de opiniões novas.
--
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run),
-- depois de 0004 e ANTES de publicar a versão do site que usa favoritos.
--
-- As duas tabelas são privadas: cada pessoa só enxerga as próprias linhas.
-- Nada daqui aparece para outras pessoas (perfis é público; por isso a
-- data de leitura não mora lá).
-- ------------------------------------------------------------------

-- ---------- Receitas guardadas ----------

create table public.favoritos (
  perfil_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  prato_slug text not null check (prato_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(prato_slug) <= 120),
  criado_em timestamptz not null default now(),
  primary key (perfil_id, prato_slug)
);

comment on table public.favoritos is 'Receitas que cada pessoa guardou. Só a própria pessoa vê.';

-- Teto generoso, só para ninguém encher o banco chamando a API à mão.
create function public.limitar_favoritos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.favoritos where perfil_id = new.perfil_id) >= 500 then
    raise exception 'limite_favoritos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger limitar_favoritos
  before insert on public.favoritos
  for each row execute function public.limitar_favoritos();

-- ---------- Quando a pessoa viu as opiniões pela última vez ----------

create table public.leituras (
  perfil_id uuid primary key references public.perfis (id) on delete cascade,
  opinioes_vistas_em timestamptz not null default now()
);

comment on table public.leituras is 'Até quando cada pessoa já viu as opiniões recebidas. Serve só para o aviso de novidades.';

-- Quem já tem conta começa "em dia": o aviso conta só o que chegar daqui em diante.
insert into public.leituras (perfil_id) select id from public.perfis;

-- Opiniões de outras pessoas nas publicações de quem chama, ainda não vistas.
-- security definer para ler leituras sem abrir a tabela; tudo é filtrado por auth.uid().
create function public.opinioes_novas()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.opinioes o
  join public.publicacoes p on p.id = o.publicacao_id
  join public.perfis eu on eu.id = p.autor_id
  left join public.leituras l on l.perfil_id = p.autor_id
  where p.autor_id = (select auth.uid())
    and o.autor_id <> p.autor_id
    and not o.oculta
    and p.status = 'aprovada'
    and o.criada_em > coalesce(l.opinioes_vistas_em, eu.criado_em);
$$;

-- Devolve até quando a pessoa já tinha visto (para marcar as novas na tela) e
-- passa a marca para agora.
create function public.marcar_opinioes_vistas()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  anterior timestamptz;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  select coalesce(
    (select opinioes_vistas_em from public.leituras where perfil_id = auth.uid()),
    (select criado_em from public.perfis where id = auth.uid())
  ) into anterior;

  insert into public.leituras (perfil_id, opinioes_vistas_em)
  values (auth.uid(), now())
  on conflict (perfil_id) do update set opinioes_vistas_em = excluded.opinioes_vistas_em;

  return anterior;
end;
$$;

revoke execute on function public.opinioes_novas(), public.marcar_opinioes_vistas() from public, anon;
grant execute on function public.opinioes_novas(), public.marcar_opinioes_vistas() to authenticated;

-- ---------- Permissões e RLS ----------

revoke all on public.favoritos, public.leituras from anon, authenticated;
grant select, delete, insert (prato_slug) on public.favoritos to authenticated;

alter table public.favoritos enable row level security;
alter table public.leituras enable row level security; -- sem políticas: só as funções acima mexem nela

create policy "ver as próprias receitas guardadas" on public.favoritos
  for select to authenticated
  using (perfil_id = (select auth.uid()));

create policy "guardar como si mesmo" on public.favoritos
  for insert to authenticated
  with check (perfil_id = (select auth.uid()));

create policy "tirar das próprias guardadas" on public.favoritos
  for delete to authenticated
  using (perfil_id = (select auth.uid()));
