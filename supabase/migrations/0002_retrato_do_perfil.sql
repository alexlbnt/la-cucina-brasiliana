-- ------------------------------------------------------------------
-- Retrato do perfil: cada pessoa escolhe um dos desenhos do Esgabilado.
--
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run),
-- depois de 0001 e ANTES de publicar a versão do site que usa o retrato.
-- Os desenhos moram no site (src/lib/retratos.ts); aqui fica só o nome
-- do escolhido. Nenhuma foto é guardada.
-- ------------------------------------------------------------------

alter table public.perfis
  add column retrato text check (
    retrato in (
      'classico', 'chef', 'provando', 'queijo', 'manjericao',
      'curioso', 'mesa', 'soneca', 'espaguete', 'panela'
    )
  );

comment on column public.perfis.retrato is 'Desenho do Esgabilado escolhido como retrato; null mostra as iniciais.';
comment on table public.perfis is 'Nome público e retrato (um desenho da casa) de quem escreve no caderno. Criado no primeiro login; não guarda e-mail nem foto.';

-- A política "editar o próprio perfil" já limita cada um à própria linha.
grant update (retrato) on public.perfis to authenticated;
