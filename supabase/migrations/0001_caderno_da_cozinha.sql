-- ------------------------------------------------------------------
-- Caderno da cozinha: perfis, publicações, opiniões e denúncias.
--
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run).
-- Toda a segurança mora aqui, nas políticas de RLS: o site só conversa
-- com o banco como a pessoa logada (ou anônima), nunca com a chave de serviço.
-- ------------------------------------------------------------------

-- ---------- Perfis ----------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  avatar_url text,
  papel text not null default 'leitor' check (papel in ('leitor', 'admin')),
  criado_em timestamptz not null default now()
);

comment on table public.perfis is 'Nome público de quem escreve no caderno. Criado no primeiro login.';

-- Cria o perfil no primeiro login com Google, usando o nome da conta.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Quem é admin. security definer para poder ser usada dentro das políticas.
create function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis where id = (select auth.uid()) and papel = 'admin'
  );
$$;

-- ---------- Publicações ----------

create table public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 3 and 120),
  texto text not null check (char_length(trim(texto)) between 10 and 5000),
  -- Prato do cardápio ligado à publicação (slug da receita), opcional.
  prato_slug text check (prato_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  criada_em timestamptz not null default now(),
  publicada_em timestamptz
);

create index publicacoes_mural on public.publicacoes (status, publicada_em desc);
create index publicacoes_autor on public.publicacoes (autor_id, criada_em desc);

-- ---------- Opiniões ----------

create table public.opinioes (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.publicacoes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 2 and 1000),
  oculta boolean not null default false,
  criada_em timestamptz not null default now()
);

create index opinioes_publicacao on public.opinioes (publicacao_id, criada_em);
create index opinioes_autor on public.opinioes (autor_id, criada_em desc);

-- ---------- Denúncias de opiniões ----------

create table public.denuncias (
  id uuid primary key default gen_random_uuid(),
  opiniao_id uuid not null references public.opinioes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  criada_em timestamptz not null default now(),
  resolvida boolean not null default false,
  unique (opiniao_id, autor_id)
);

-- ---------- Regras automáticas ----------

-- Limite de envios por pessoa, contra spam.
create function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite int;
  recentes int;
begin
  if tg_table_name = 'publicacoes' then
    limite := 3;
    select count(*) into recentes from public.publicacoes
      where autor_id = new.autor_id and criada_em > now() - interval '1 day';
  else
    limite := 30;
    select count(*) into recentes from public.opinioes
      where autor_id = new.autor_id and criada_em > now() - interval '1 day';
  end if;

  if recentes >= limite then
    raise exception 'limite_diario' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger limitar_publicacoes
  before insert on public.publicacoes
  for each row execute function public.limitar_envios();

create trigger limitar_opinioes
  before insert on public.opinioes
  for each row execute function public.limitar_envios();

-- Marca a data de publicação quando a publicação é aprovada.
create function public.marcar_publicacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'aprovada' and old.status is distinct from 'aprovada' then
    new.publicada_em := now();
  end if;
  return new;
end;
$$;

create trigger marcar_publicacao
  before update of status on public.publicacoes
  for each row execute function public.marcar_publicacao();

-- Publicações de admin entram já aprovadas. Toda publicação que nasce aprovada
-- ganha data de publicação; assim, para desligar a aprovação prévia basta:
--   alter table public.publicacoes alter column status set default 'aprovada';
create function public.aprovar_publicacao_de_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.eh_admin() then
    new.status := 'aprovada';
  end if;
  if new.status = 'aprovada' then
    new.publicada_em := now();
  end if;
  return new;
end;
$$;

create trigger aprovar_publicacao_de_admin
  before insert on public.publicacoes
  for each row execute function public.aprovar_publicacao_de_admin();

-- Apaga a conta de quem chama, com tudo o que escreveu (LGPD).
create function public.apagar_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.apagar_minha_conta() from public, anon;
grant execute on function public.apagar_minha_conta() to authenticated;

-- ---------- Permissões por coluna ----------
-- Ninguém além do banco mexe em papel, status, datas ou autoria.

revoke all on public.perfis, public.publicacoes, public.opinioes, public.denuncias from anon, authenticated;

grant select on public.perfis, public.publicacoes, public.opinioes to anon, authenticated;
grant update (nome) on public.perfis to authenticated;

grant insert (titulo, texto, prato_slug) on public.publicacoes to authenticated;
grant update (status) on public.publicacoes to authenticated; -- a política restringe a admin
grant delete on public.publicacoes to authenticated;

grant insert (publicacao_id, texto) on public.opinioes to authenticated;
grant update (oculta) on public.opinioes to authenticated; -- a política restringe a admin
grant delete on public.opinioes to authenticated;

grant select, insert (opiniao_id) on public.denuncias to authenticated;
grant update (resolvida) on public.denuncias to authenticated; -- a política restringe a admin

-- ---------- RLS ----------

alter table public.perfis enable row level security;
alter table public.publicacoes enable row level security;
alter table public.opinioes enable row level security;
alter table public.denuncias enable row level security;

-- Perfis: nomes são públicos; cada um edita o próprio.
create policy "perfis visíveis" on public.perfis
  for select using (true);

create policy "editar o próprio perfil" on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Publicações
create policy "ler publicações aprovadas, as próprias ou tudo (admin)" on public.publicacoes
  for select using (
    status = 'aprovada'
    or autor_id = (select auth.uid())
    or (select public.eh_admin())
  );

create policy "publicar como si mesmo" on public.publicacoes
  for insert to authenticated
  with check (autor_id = (select auth.uid()));

create policy "admin modera publicações" on public.publicacoes
  for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "apagar a própria publicação ou moderar" on public.publicacoes
  for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.eh_admin()));

-- Opiniões
create policy "ler opiniões visíveis, as próprias ou tudo (admin)" on public.opinioes
  for select using (
    (
      not oculta
      and exists (
        select 1 from public.publicacoes p
        where p.id = publicacao_id and p.status = 'aprovada'
      )
    )
    or autor_id = (select auth.uid())
    or (select public.eh_admin())
  );

create policy "opinar em publicação aprovada" on public.opinioes
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.publicacoes p
      where p.id = publicacao_id and p.status = 'aprovada'
    )
  );

create policy "admin oculta opiniões" on public.opinioes
  for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "apagar a própria opinião ou moderar" on public.opinioes
  for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.eh_admin()));

-- Denúncias: quem denuncia vê a própria; admin vê e resolve todas.
create policy "denunciar como si mesmo" on public.denuncias
  for insert to authenticated
  with check (autor_id = (select auth.uid()));

create policy "ver denúncias próprias ou todas (admin)" on public.denuncias
  for select to authenticated
  using (autor_id = (select auth.uid()) or (select public.eh_admin()));

create policy "admin resolve denúncias" on public.denuncias
  for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));
