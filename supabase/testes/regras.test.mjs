/**
 * Testa a migração do Caderno da cozinha num Postgres em memória (PGlite),
 * com um esboço mínimo do que o Supabase oferece: schema auth, auth.uid()
 * e os papéis anon/authenticated.
 *
 * Uso: npm run testar:banco
 */
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const ANA = '00000000-0000-0000-0000-00000000000a';
const BETO = '00000000-0000-0000-0000-00000000000b';
const CHEF = '00000000-0000-0000-0000-00000000000c';

const ESBOCO_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`;

let db;

/** Roda `sql` como uma pessoa (uuid), como anônimo (null) ou como o dono do banco ('dono'). */
async function como(quem, sql, params = []) {
  if (quem === 'dono') return db.query(sql, params);
  await db.exec(
    quem
      ? `set role authenticated; select set_config('request.jwt.claim.sub', '${quem}', false);`
      : `set role anon; select set_config('request.jwt.claim.sub', '', false);`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

async function falha(promessa, trecho) {
  await assert.rejects(promessa, (erro) => {
    assert.match(String(erro.message), trecho);
    return true;
  });
}

before(async () => {
  db = new PGlite();
  await db.exec(ESBOCO_SUPABASE);
  const migracao = await readFile(
    new URL('../migrations/0001_caderno_da_cozinha.sql', import.meta.url),
    'utf8',
  );
  await db.exec(migracao);

  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'ana@exemplo.com', '{"full_name": "Ana Souza", "avatar_url": "https://exemplo.com/a.png"}'),
      ($2, 'beto@exemplo.com', '{}'),
      ($3, 'chef@exemplo.com', '{"name": "Cozinheiro"}')`,
    [ANA, BETO, CHEF],
  );
  await db.query(`update public.perfis set papel = 'admin' where id = $1`, [CHEF]);
});

after(async () => {
  await db?.close();
});

describe('perfis', () => {
  test('nascem no primeiro login com o nome da conta Google', async () => {
    const { rows } = await como('dono', 'select id, nome, papel from public.perfis order by id');
    assert.deepEqual(
      rows.map((r) => [r.nome, r.papel]),
      [
        ['Ana Souza', 'leitor'],
        ['beto', 'leitor'],
        ['Cozinheiro', 'admin'],
      ],
    );
  });

  test('ninguém se promove a admin', async () => {
    await falha(como(ANA, `update public.perfis set papel = 'admin' where id = $1`, [ANA]), /permission denied/);
  });

  test('cada um muda só o próprio nome', async () => {
    await como(ANA, `update public.perfis set nome = 'Aninha' where id = $1`, [ANA]);
    const outro = await como(ANA, `update public.perfis set nome = 'Hackeado' where id = $1`, [BETO]);
    assert.equal(outro.affectedRows, 0);
    const { rows } = await como('dono', 'select nome from public.perfis where id = $1', [BETO]);
    assert.equal(rows[0].nome, 'beto');
  });
});

describe('publicações', () => {
  let idDaAna;

  test('anônimo não publica', async () => {
    await falha(
      como(null, `insert into public.publicacoes (titulo, texto) values ('Oi', 'Um texto qualquer aqui')`),
      /permission denied/,
    );
  });

  test('leitor publica e a publicação nasce pendente, em nome dele', async () => {
    const { rows } = await como(
      ANA,
      `insert into public.publicacoes (titulo, texto, prato_slug)
       values ('Fiz o arroz', 'Ficou ótimo com bastante alho.', 'arroz-chamado-no-alho')
       returning id, autor_id, status, publicada_em`,
    );
    idDaAna = rows[0].id;
    assert.equal(rows[0].autor_id, ANA);
    assert.equal(rows[0].status, 'pendente');
    assert.equal(rows[0].publicada_em, null);
  });

  test('ninguém escolhe o próprio status nem publica em nome de outro', async () => {
    await falha(
      como(ANA, `insert into public.publicacoes (titulo, texto, status) values ('Pulando a fila', 'Texto texto texto', 'aprovada')`),
      /permission denied/,
    );
    await falha(
      como(ANA, `insert into public.publicacoes (titulo, texto, autor_id) values ('Sou o Beto', 'Texto texto texto', $1)`, [BETO]),
      /permission denied/,
    );
  });

  test('pendente só aparece para quem escreveu e para o admin', async () => {
    const sql = 'select id from public.publicacoes where id = $1';
    assert.equal((await como(null, sql, [idDaAna])).rows.length, 0);
    assert.equal((await como(BETO, sql, [idDaAna])).rows.length, 0);
    assert.equal((await como(ANA, sql, [idDaAna])).rows.length, 1);
    assert.equal((await como(CHEF, sql, [idDaAna])).rows.length, 1);
  });

  test('leitor não aprova, nem a própria', async () => {
    const r = await como(ANA, `update public.publicacoes set status = 'aprovada' where id = $1`, [idDaAna]);
    assert.equal(r.affectedRows, 0);
  });

  test('admin aprova, a data de publicação é marcada e todos passam a ver', async () => {
    await como(CHEF, `update public.publicacoes set status = 'aprovada' where id = $1`, [idDaAna]);
    const { rows } = await como(null, 'select status, publicada_em from public.publicacoes where id = $1', [idDaAna]);
    assert.equal(rows[0].status, 'aprovada');
    assert.ok(rows[0].publicada_em);
  });

  test('publicação do admin já nasce aprovada', async () => {
    const { rows } = await como(
      CHEF,
      `insert into public.publicacoes (titulo, texto) values ('Da cozinha', 'Novidade no cardápio em breve.') returning status`,
    );
    assert.equal(rows[0].status, 'aprovada');
  });

  test('limite de 3 publicações por dia', async () => {
    for (let i = 1; i <= 3; i++) {
      await como(BETO, `insert into public.publicacoes (titulo, texto) values ($1, 'Texto de teste número um')`, [`Teste ${i}`]);
    }
    await falha(
      como(BETO, `insert into public.publicacoes (titulo, texto) values ('Quarta', 'Texto de teste número um')`),
      /limite_diario/,
    );
  });

  test('textos curtos demais são recusados', async () => {
    await falha(como(CHEF, `insert into public.publicacoes (titulo, texto) values ('Oi', 'curto')`), /check constraint/);
  });

  test('ninguém apaga a publicação dos outros', async () => {
    const r = await como(BETO, 'delete from public.publicacoes where id = $1', [idDaAna]);
    assert.equal(r.affectedRows, 0);
  });
});

describe('opiniões e denúncias', () => {
  let publicacaoAprovada;
  let publicacaoPendente;
  let opiniaoDoBeto;

  before(async () => {
    publicacaoAprovada = (
      await como('dono', `select id from public.publicacoes where status = 'aprovada' and autor_id = $1`, [ANA])
    ).rows[0].id;
    publicacaoPendente = (
      await como('dono', `select id from public.publicacoes where status = 'pendente' and autor_id = $1 limit 1`, [BETO])
    ).rows[0].id;
  });

  test('anônimo lê mas não opina', async () => {
    await falha(
      como(null, `insert into public.opinioes (publicacao_id, texto) values ($1, 'Que delícia')`, [publicacaoAprovada]),
      /permission denied/,
    );
  });

  test('leitor opina em publicação aprovada', async () => {
    const { rows } = await como(
      BETO,
      `insert into public.opinioes (publicacao_id, texto) values ($1, 'Vou testar com limão!') returning id, autor_id`,
      [publicacaoAprovada],
    );
    opiniaoDoBeto = rows[0].id;
    assert.equal(rows[0].autor_id, BETO);
  });

  test('não dá para opinar em publicação pendente', async () => {
    await falha(
      como(ANA, `insert into public.opinioes (publicacao_id, texto) values ($1, 'Oi, tudo bem?')`, [publicacaoPendente]),
      /row-level security/,
    );
  });

  test('qualquer leitor denuncia uma vez; só admin vê as denúncias de todos', async () => {
    await como(ANA, 'insert into public.denuncias (opiniao_id) values ($1)', [opiniaoDoBeto]);
    await falha(como(ANA, 'insert into public.denuncias (opiniao_id) values ($1)', [opiniaoDoBeto]), /duplicate key/);
    assert.equal((await como(BETO, 'select * from public.denuncias')).rows.length, 0);
    assert.equal((await como(CHEF, 'select * from public.denuncias')).rows.length, 1);
  });

  test('leitor não oculta opinião; admin oculta e ela some para o público', async () => {
    const r = await como(ANA, 'update public.opinioes set oculta = true where id = $1', [opiniaoDoBeto]);
    assert.equal(r.affectedRows, 0);

    await como(CHEF, 'update public.opinioes set oculta = true where id = $1', [opiniaoDoBeto]);
    const sql = 'select id from public.opinioes where id = $1';
    assert.equal((await como(null, sql, [opiniaoDoBeto])).rows.length, 0);
    assert.equal((await como(ANA, sql, [opiniaoDoBeto])).rows.length, 0);
    assert.equal((await como(BETO, sql, [opiniaoDoBeto])).rows.length, 1, 'o autor ainda vê a própria');
  });
});

describe('apagar a conta', () => {
  test('anônimo não pode chamar', async () => {
    await falha(como(null, 'select public.apagar_minha_conta()'), /permission denied/);
  });

  test('apaga a pessoa e tudo o que ela escreveu', async () => {
    await como(BETO, 'select public.apagar_minha_conta()');
    const contar = async (tabela, coluna) =>
      Number((await como('dono', `select count(*) as n from ${tabela} where ${coluna} = $1`, [BETO])).rows[0].n);
    assert.equal(await contar('auth.users', 'id'), 0);
    assert.equal(await contar('public.perfis', 'id'), 0);
    assert.equal(await contar('public.publicacoes', 'autor_id'), 0);
    assert.equal(await contar('public.opinioes', 'autor_id'), 0);
  });
});
