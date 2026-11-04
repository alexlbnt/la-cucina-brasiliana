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
  for (const arquivo of ['0001_caderno_da_cozinha.sql', '0002_retrato_do_perfil.sql', '0003_editar_publicacao.sql', '0004_publicacao_sem_aprovacao.sql', '0005_favoritos_e_avisos.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8'));
  }

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

describe('retrato', () => {
  test('nasce vazio (mostra as iniciais)', async () => {
    const { rows } = await como('dono', 'select retrato from public.perfis where id = $1', [ANA]);
    assert.equal(rows[0].retrato, null);
  });

  test('cada um escolhe o próprio retrato, e só entre os desenhos da casa', async () => {
    await como(ANA, `update public.perfis set retrato = 'chef' where id = $1`, [ANA]);
    await falha(
      como(ANA, `update public.perfis set retrato = 'https://exemplo.com/foto.png' where id = $1`, [ANA]),
      /check constraint/,
    );
    const outro = await como(ANA, `update public.perfis set retrato = 'soneca' where id = $1`, [BETO]);
    assert.equal(outro.affectedRows, 0);

    const { rows } = await como(null, 'select id, retrato from public.perfis where id in ($1, $2) order by id', [ANA, BETO]);
    assert.deepEqual(
      rows.map((r) => r.retrato),
      ['chef', null],
    );
  });

  test('voltar para as iniciais', async () => {
    await como(ANA, `update public.perfis set retrato = null where id = $1`, [ANA]);
    const { rows } = await como('dono', 'select retrato from public.perfis where id = $1', [ANA]);
    assert.equal(rows[0].retrato, null);
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

  test('leitor publica e a publicação já entra no caderno, em nome dele', async () => {
    const { rows } = await como(
      ANA,
      `insert into public.publicacoes (titulo, texto, prato_slug)
       values ('Fiz o arroz', 'Ficou ótimo com bastante alho.', 'arroz-chamado-no-alho')
       returning id, autor_id, status, publicada_em`,
    );
    idDaAna = rows[0].id;
    assert.equal(rows[0].autor_id, ANA);
    assert.equal(rows[0].status, 'aprovada');
    assert.ok(rows[0].publicada_em);
    assert.equal((await como(null, 'select id from public.publicacoes where id = $1', [idDaAna])).rows.length, 1);
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

  test('leitor não muda o status, nem da própria', async () => {
    const r = await como(ANA, `update public.publicacoes set status = 'recusada' where id = $1`, [idDaAna]);
    assert.equal(r.affectedRows, 0);
  });

  test('admin recusa e a publicação só fica visível para quem escreveu e para o admin', async () => {
    await como(CHEF, `update public.publicacoes set status = 'recusada' where id = $1`, [idDaAna]);
    const sql = 'select id from public.publicacoes where id = $1';
    assert.equal((await como(null, sql, [idDaAna])).rows.length, 0);
    assert.equal((await como(BETO, sql, [idDaAna])).rows.length, 0);
    assert.equal((await como(ANA, sql, [idDaAna])).rows.length, 1);
    assert.equal((await como(CHEF, sql, [idDaAna])).rows.length, 1);
  });

  test('admin aprova de volta, a data de publicação é marcada e todos passam a ver', async () => {
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

  test('admin apaga a publicação de qualquer pessoa', async () => {
    const { rows } = await como(
      'dono',
      `insert into public.publicacoes (autor_id, titulo, texto) values ($1, 'Spam', 'Compre já, compre já!') returning id`,
      [ANA],
    );
    const r = await como(CHEF, 'delete from public.publicacoes where id = $1', [rows[0].id]);
    assert.equal(r.affectedRows, 1);
  });
});

describe('editar publicação', () => {
  const editar = (quem, id, titulo, texto, prato = null) =>
    como(quem, 'select public.editar_publicacao($1, $2, $3, $4) as status', [id, titulo, texto, prato]);
  const ler = async (id) =>
    (await como('dono', 'select titulo, texto, status, publicada_em, editada_em from public.publicacoes where id = $1', [id])).rows[0];
  let daAna;
  let doChef;

  before(async () => {
    daAna = (
      await como('dono', `insert into public.publicacoes (autor_id, titulo, texto, status, publicada_em)
        values ($1, 'Risoto', 'Ficou cremoso demais.', 'aprovada', now()) returning id`, [ANA])
    ).rows[0].id;
    doChef = (
      await como(CHEF, `insert into public.publicacoes (titulo, texto) values ('Aviso', 'Cardápio novo chegando.') returning id`)
    ).rows[0].id;
  });

  test('anônimo não edita', async () => {
    await falha(editar(null, daAna, 'Risoto', 'Hackeado aqui'), /permission denied/);
  });

  test('ninguém edita a publicação dos outros, nem o admin', async () => {
    await falha(editar(BETO, daAna, 'Risoto', 'Hackeado aqui'), /publicacao_nao_encontrada/);
    await falha(editar(CHEF, daAna, 'Risoto', 'Hackeado aqui'), /publicacao_nao_encontrada/);
    assert.equal((await ler(daAna)).texto, 'Ficou cremoso demais.');
  });

  test('salvar sem mudar nada não tira do caderno', async () => {
    const { rows } = await editar(ANA, daAna, 'Risoto', 'Ficou cremoso demais.');
    assert.equal(rows[0].status, 'aprovada');
    assert.equal((await ler(daAna)).editada_em, null);
  });

  test('leitor edita e a publicação continua no caderno', async () => {
    const { rows } = await editar(ANA, daAna, 'Risoto de cogumelos', 'Ficou cremoso no ponto certo.');
    assert.equal(rows[0].status, 'aprovada');
    const depois = await ler(daAna);
    assert.equal(depois.titulo, 'Risoto de cogumelos');
    assert.equal(depois.status, 'aprovada');
    assert.ok(depois.publicada_em);
    assert.ok(depois.editada_em);
  });

  test('o admin edita a própria e ela continua no caderno', async () => {
    const { rows } = await editar(CHEF, doChef, 'Aviso', 'Cardápio novo chegando na sexta.');
    assert.equal(rows[0].status, 'aprovada');
    const depois = await ler(doChef);
    assert.equal(depois.status, 'aprovada');
    assert.ok(depois.publicada_em);
    assert.ok(depois.editada_em);
  });

  test('as regras de tamanho valem na edição', async () => {
    await falha(editar(ANA, daAna, 'Oi', 'curto'), /check constraint/);
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
      await como('dono', `insert into public.publicacoes (autor_id, titulo, texto, status)
        values ($1, 'Fora do caderno', 'Esta foi recusada pela moderação.', 'recusada') returning id`, [CHEF])
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

  test('não dá para opinar em publicação fora do caderno', async () => {
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

describe('receitas guardadas', () => {
  test('anônimo não guarda nem lê', async () => {
    await falha(como(null, `insert into public.favoritos (prato_slug) values ('pure-de-batata')`), /permission denied/);
    await falha(como(null, 'select * from public.favoritos'), /permission denied/);
  });

  test('cada pessoa guarda e vê só as próprias', async () => {
    await como(ANA, `insert into public.favoritos (prato_slug) values ('pure-de-batata'), ('arroz-chamado-no-alho')`);
    await como(BETO, `insert into public.favoritos (prato_slug) values ('pure-de-batata')`);
    const daAna = await como(ANA, 'select perfil_id, prato_slug from public.favoritos order by prato_slug');
    assert.deepEqual(
      daAna.rows.map((r) => r.prato_slug),
      ['arroz-chamado-no-alho', 'pure-de-batata'],
    );
    assert.ok(daAna.rows.every((r) => r.perfil_id === ANA));
    assert.equal((await como(BETO, 'select * from public.favoritos')).rows.length, 1);
  });

  test('guardar de novo não duplica', async () => {
    await como(ANA, `insert into public.favoritos (prato_slug) values ('pure-de-batata') on conflict do nothing`);
    assert.equal((await como(ANA, 'select * from public.favoritos')).rows.length, 2);
  });

  test('ninguém guarda em nome de outro nem tira das guardadas dos outros', async () => {
    await falha(
      como(ANA, `insert into public.favoritos (perfil_id, prato_slug) values ($1, 'omelete')`, [BETO]),
      /permission denied/,
    );
    const r = await como(ANA, 'delete from public.favoritos where perfil_id = $1', [BETO]);
    assert.equal(r.affectedRows, 0);
    assert.equal((await como(BETO, 'select * from public.favoritos')).rows.length, 1);
  });

  test('só aceita endereços de receita', async () => {
    await falha(como(ANA, `insert into public.favoritos (prato_slug) values ('<script>')`), /check constraint/);
  });

  test('tirar das guardadas', async () => {
    await como(ANA, `delete from public.favoritos where prato_slug = 'arroz-chamado-no-alho'`);
    assert.equal((await como(ANA, 'select * from public.favoritos')).rows.length, 1);
  });
});

describe('aviso de opiniões novas', () => {
  let daAna;

  before(async () => {
    daAna = (
      await como('dono', `insert into public.publicacoes (autor_id, titulo, texto) values ($1, 'Fiz o purê', 'Ficou cremoso demais!') returning id`, [ANA])
    ).rows[0].id;
  });

  const novas = async (quem) => (await como(quem, 'select public.opinioes_novas() as n')).rows[0].n;

  test('anônimo não consulta nem marca', async () => {
    await falha(como(null, 'select public.opinioes_novas()'), /permission denied/);
    await falha(como(null, 'select public.marcar_opinioes_vistas()'), /permission denied/);
  });

  test('conta só opiniões de outras pessoas nas publicações de quem pergunta', async () => {
    const antes = await novas(ANA);
    await como(ANA, `insert into public.opinioes (publicacao_id, texto) values ($1, 'Eu mesma comentando')`, [daAna]);
    assert.equal(await novas(ANA), antes, 'a própria opinião não conta');

    await como(CHEF, `insert into public.opinioes (publicacao_id, texto) values ($1, 'Que beleza!')`, [daAna]);
    assert.equal(await novas(ANA), antes + 1);
    assert.equal(await novas(CHEF), 0, 'o Chef não recebe aviso da publicação da Ana');
  });

  test('marcar como vistas zera o aviso e devolve a marca anterior', async () => {
    const { rows } = await como(ANA, 'select public.marcar_opinioes_vistas() as anterior');
    assert.ok(rows[0].anterior instanceof Date);
    assert.equal(await novas(ANA), 0);

    await como(CHEF, `insert into public.opinioes (publicacao_id, texto) values ($1, 'Passei de novo')`, [daAna]);
    assert.equal(await novas(ANA), 1);
  });

  test('opinião oculta pela moderação não conta', async () => {
    await como(CHEF, `update public.opinioes set oculta = true where texto = 'Passei de novo'`);
    assert.equal(await novas(ANA), 0);
  });

  test('a marca de leitura é privada', async () => {
    await falha(como(BETO, 'select * from public.leituras'), /permission denied/);
    await falha(como(ANA, 'select * from public.leituras'), /permission denied/);
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
    assert.equal(await contar('public.favoritos', 'perfil_id'), 0);
  });
});
