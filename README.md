# La cucina brasiliana

Meu repertório de pratos, do jeito que eu faço: base italiana, ingredientes simples e espaço para improvisar. Quantidades no olho, como o coração mandar!

Feito com [Astro](https://astro.build), TypeScript e CSS próprio. O cardápio, as receitas e a Sobre são páginas estáticas. O **Caderno da cozinha**, na página inicial, é um mural onde quem entra com Google escreve publicações e opiniões, guardadas no [Supabase](https://supabase.com). Sem analytics, sem anúncios, sem cookies de terceiros.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 22.23 ou mais novo (o 24 é o recomendado).

```bash
npm install     # instala as dependências (só na primeira vez)
npm run dev     # abre o site em http://localhost:4321 e recarrega a cada mudança
```

Sem o arquivo `.env`, o site funciona normalmente e o Caderno mostra o aviso "ainda está sendo preparado". Para ligá-lo, veja [Caderno da cozinha](#caderno-da-cozinha).

Outros comandos:

| Comando           | O que faz                                                        |
| ----------------- | ---------------------------------------------------------------- |
| `npm run build`   | gera o site no formato da Vercel (pasta `.vercel/output/`)       |
| `npm run check`   | confere os tipos e o frontmatter das receitas                    |
| `npm run testar`  | roda os testes (formatação de texto e regras de acesso do banco) |
| `npm run imagens` | refaz o favicon e a imagem de compartilhamento (veja abaixo)     |
| `npm run esgabilado` | separa as artes do Esgabilado em máscaras (veja abaixo)       |

## Como adicionar uma receita

Cada prato é um arquivo Markdown em `src/content/receitas/`. Para criar um novo:

1. Copie um arquivo existente, por exemplo `02-arroz-chamado-no-alho.md`, e dê um nome novo a ele (`06-nome-do-prato.md`). O nome do arquivo serve só para organizar a pasta.
2. Preencha o frontmatter:

```yaml
---
numero: 6                      # ordem no site; não pode repetir
titulo: Nome do prato
slug: nome-do-prato            # vira o endereço /receitas/nome-do-prato (minúsculas, sem acento, com hífens)
categoria: Massas              # Massas, Arroz, Peixes, Acompanhamentos ou Ovos
descricao: Uma frase curta que aparece no cardápio e no topo da receita.
ingredientes:
  - Primeiro ingrediente
  - Segundo ingrediente
preparo:
  - Primeiro passo.
  - Segundo passo.
variacoes:                     # opcional; apague o bloco inteiro se não houver
  - texto: Uma variação que já deu certo.
    emTeste: false
  - texto: Uma ideia que ainda estou testando.
    emTeste: true              # aparece com a marca "em teste"
foto:                          # opcional; veja abaixo
---
```

3. Salve. Com o `npm run dev` rodando, o prato aparece na hora no cardápio, na seção da categoria, e ganha página própria com links para a receita anterior e a próxima.

Se algum campo estiver errado (categoria que não existe, número repetido, lista vazia), o site avisa no terminal qual arquivo e qual campo corrigir.

Dica: em YAML, textos com dois-pontos (`:`) ou apóstrofo (`'`) precisam ficar entre aspas duplas, como `titulo: "Omelete de Frumag'e"`.

### Fotos

Enquanto `foto` estiver vazio, a receita mostra um espaço reservado discreto com o Esgabilado. Para colocar uma foto, salve a imagem em `public/fotos/` (por exemplo `public/fotos/arroz.jpg`) e escreva `foto: /fotos/arroz.jpg`. Fotos horizontais funcionam melhor.

### Nova categoria

As seções do cardápio e a ordem delas ficam em `src/lib/categorias.ts`. Acrescente o nome lá e use-o no campo `categoria`.

## Caderno da cozinha

O mural da página inicial. Qualquer pessoa lê. Para escrever ou opinar, é preciso entrar com Google.

- **Publicações** passam por aprovação antes de aparecer. As suas (admin) entram direto, em destaque, como "Da cozinha".
- **Editar:** quem escreveu pode editar a própria publicação. Se for de leitor e já estiver aprovada, ela volta para a aprovação até você ler a edição; as suas continuam no ar. A publicação ganha a marca "Editada em".
- **Opiniões** aparecem na hora. Qualquer pessoa logada pode denunciar uma opinião, e você decide em **Moderar** se ela é ocultada ou mantida.
- **Limites contra spam:** cada pessoa pode enviar 3 publicações e 30 opiniões por dia. Um campo-isca invisível barra robôs.
- **Minha conta:** cada pessoa muda o próprio nome, escolhe um dos 10 retratos do Esgabilado (desenhados em SVG em `src/lib/retratos.ts`; sem escolha, aparecem as iniciais), acompanha as próprias publicações e pode apagar a conta com tudo o que escreveu.
- **Privacidade:** o site guarda só nome, e-mail (nunca exibido) e o que a pessoa escreve. A foto da conta Google não é guardada nem carregada. As páginas `/privacidade` e `/termos` trazem o e-mail de contato e a data de atualização no topo do arquivo; atualize os dois se algo mudar.

Toda a segurança está no banco. As regras de acesso (RLS) ficam em `supabase/migrations/` e são testadas com `npm run testar`.

### Ligar o Caderno (só uma vez)

**1. Criar o banco no Supabase**

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com). O plano gratuito basta.
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/migrations/0001_caderno_da_cozinha.sql` e clique em **Run**. Depois, numa nova query, faça o mesmo com `0002_retrato_do_perfil.sql` e depois com `0003_editar_publicacao.sql` (os arquivos rodam em ordem, cada um uma vez só).

**2. Ativar o login com Google**

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**.
   - Em **URIs de redirecionamento autorizados**, coloque `https://SEU-PROJETO.supabase.co/auth/v1/callback`. O endereço exato aparece no Supabase, no item seguinte.
   - Configure também a **Tela de consentimento OAuth** com o nome "La cucina brasiliana".
2. No Supabase, em **Authentication → Sign In / Providers → Google**, ative o provedor e cole o **Client ID** e o **Client Secret** gerados pelo Google.
3. Ainda no Supabase, em **Authentication → URL Configuration**:
   - **Site URL:** o endereço final do site (ex.: `https://lacucinabrasiliana.vercel.app`).
   - **Redirect URLs:** acrescente `https://SEU-DOMINIO/api/auth/retorno` e, para testar no computador, `http://localhost:4321/api/auth/retorno`.

**3. Ligar o site ao banco**

No Supabase, em **Project Settings → API**, copie a **Project URL** e a chave **anon public**. No computador, copie `.env.example` para `.env` e preencha:

```bash
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
```

A chave `anon` pode ficar no site, porque quem protege os dados são as regras do banco. **Nunca** use a chave `service_role` aqui.

**4. Virar admin**

Entre no site com a sua conta Google uma vez. Depois, no **SQL Editor** do Supabase, rode o comando abaixo, trocando o e-mail pelo seu:

```sql
update public.perfis set papel = 'admin'
where id = (select id from auth.users where email = 'seu-email@gmail.com');
```

Pronto: o link **Moderar** aparece no Caderno, e as suas publicações entram direto como "Da cozinha".

**Para desligar a aprovação prévia** (se o volume for baixo e você confiar em quem escreve), rode no SQL Editor:

```sql
alter table public.publicacoes alter column status set default 'aprovada';
```

## Como publicar na Vercel

1. Suba este repositório para o GitHub (ou GitLab/Bitbucket).
2. Na [Vercel](https://vercel.com/new), clique em **Add New → Project** e importe o repositório. A Vercel reconhece o Astro sozinha (**Framework Preset: Astro**). Não mexa no Build Command nem no Output Directory.
3. Em **Environment Variables**, crie:
   - `SITE_URL`: o endereço final do site (ex.: `https://lacucinabrasiliana.vercel.app` ou o seu domínio). É usado nos links de compartilhamento.
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY`: os mesmos valores do `.env`. Se preferir, a [integração do Supabase com a Vercel](https://vercel.com/marketplace/supabase) cria as duas sozinha.
4. Clique em **Deploy**. A partir daí, cada `git push` na branch principal publica o site de novo.

O cardápio, as receitas e a Sobre são servidos como arquivos estáticos. Só as páginas do Caderno rodam como função na Vercel.

## Organização

```
src/
├─ content/receitas/   uma receita por arquivo .md
├─ content.config.ts   o formato (schema) que cada receita precisa seguir
├─ middleware.ts       identifica quem está logado nas páginas do Caderno
├─ lib/
│  ├─ categorias.ts    seções do cardápio, em ordem
│  ├─ receitas.ts      ordenação, agrupamento e anterior/próxima
│  ├─ simbolos.ts      os desenhos do ratinho, do raminho e do selo (SVG)
│  ├─ supabase.ts      conexão com o banco, como a pessoa logada
│  ├─ caderno.ts       tipos, limites e mensagens do Caderno
│  └─ texto.ts         formatação segura do que as pessoas escrevem
├─ assets/esgabilado/  as cenas do Esgabilado, já separadas em traço e folhas
├─ components/         Ratinho, Esgabilado, Raminho, Selo, Separador, Moldura, cabeçalho e rodapé
│  └─ caderno/         cartão do mural, assinatura, monograma e barra de sessão
├─ layouts/Base.astro  estrutura comum de todas as páginas
├─ pages/
│  ├─ index.astro      início + Caderno da cozinha
│  ├─ caderno/         publicação (com opiniões) e escrever
│  ├─ api/auth/        login com Google, retorno e sair
│  └─ ...              cardápio, receitas, sobre, entrar, conta, moderar, privacidade, termos e 404
└─ styles/global.css   cores, fontes, formulários e modo escuro
arte/esgabilado/           as artes originais do Esgabilado, sobre o creme
scripts/gerar-imagens.mjs  gera favicon e imagem Open Graph a partir do selo
scripts/separar-esgabilado.mjs  separa as artes do Esgabilado em máscaras
supabase/migrations/       o banco do Caderno (tabelas e regras de acesso)
supabase/testes/           testes das regras de acesso, num Postgres em memória
tests/                     testes da formatação de texto
```

As cores ficam em variáveis no topo de `src/styles/global.css`. O tema segue o modo claro ou escuro do navegador de quem visita; se a pessoa trocar no botão do cabeçalho, a escolha fica salva para as próximas visitas.

O favicon e a imagem de compartilhamento (`public/favicon.svg`, `favicon.png`, `apple-touch-icon.png` e `og.png`) já estão prontos. Só é preciso rodar `npm run imagens` de novo se o desenho do selo mudar.

O Esgabilado, o ratinho cozinheiro, aparece em cinco cenas: panela (Sobre), tigela (receitas sem foto), colher de pau (404), prato servido (topo do cardápio) e queijo com uvas (seção Acompanhamentos). As artes originais ficam em `arte/esgabilado/`. O script `npm run esgabilado` separa cada uma em duas máscaras transparentes, o traço e as folhas, que o site pinta com as cores do tema. Para trocar ou acrescentar uma cena, salve o PNG em `arte/esgabilado/` com o nome da cena, rode o script e acrescente o nome ao tipo `Cena` em `src/components/Esgabilado.astro`.
