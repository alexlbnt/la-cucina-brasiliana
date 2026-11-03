# La cucina brasiliana

Meu repertório de pratos, do jeito que eu faço: base italiana, ingredientes simples e espaço para improvisar. Quantidades no olho, como o coração mandar!

Site estático feito com [Astro](https://astro.build), TypeScript e CSS próprio. Sem backend, sem banco, sem rastreamento.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 22.23 ou mais novo (o 24 é o recomendado).

```bash
npm install     # instala as dependências (só na primeira vez)
npm run dev     # abre o site em http://localhost:4321 e recarrega a cada mudança
```

Outros comandos:

| Comando           | O que faz                                                   |
| ----------------- | ----------------------------------------------------------- |
| `npm run build`   | gera o site pronto para publicar na pasta `dist/`           |
| `npm run preview` | serve a pasta `dist/` localmente, para conferir o build     |
| `npm run check`   | confere os tipos e o frontmatter das receitas               |
| `npm run imagens` | refaz o favicon e a imagem de compartilhamento (veja abaixo)|

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

Enquanto `foto` estiver vazio, a receita mostra um espaço reservado discreto com o ratinho. Para colocar uma foto, salve a imagem em `public/fotos/` (por exemplo `public/fotos/arroz.jpg`) e escreva `foto: /fotos/arroz.jpg`. Fotos horizontais funcionam melhor.

### Nova categoria

As seções do cardápio e a ordem delas ficam em `src/lib/categorias.ts`. Acrescente o nome lá e use-o no campo `categoria`.

## Como publicar na Vercel

1. Suba este repositório para o GitHub (ou GitLab/Bitbucket).
2. Na [Vercel](https://vercel.com/new), clique em **Add New → Project** e importe o repositório.
3. A Vercel reconhece o Astro sozinha. Confira só se está assim:
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Em **Environment Variables**, crie `SITE_URL` com o endereço final do site (ex.: `https://lacucinabrasiliana.vercel.app` ou o seu domínio). Ele é usado nos links de compartilhamento.
5. Clique em **Deploy**. A partir daí, cada `git push` na branch principal publica o site de novo.

## Organização

```
src/
├─ content/receitas/   uma receita por arquivo .md
├─ content.config.ts   o formato (schema) que cada receita precisa seguir
├─ lib/
│  ├─ categorias.ts    seções do cardápio, em ordem
│  ├─ receitas.ts      ordenação, agrupamento e anterior/próxima
│  └─ simbolos.ts      os desenhos do ratinho, do raminho e do selo (SVG)
├─ components/         Ratinho, Raminho, Selo, Separador, Moldura, cabeçalho e rodapé
├─ layouts/Base.astro  estrutura comum de todas as páginas
├─ pages/              início, cardápio, receitas, sobre e 404
└─ styles/global.css   cores, fontes e modo escuro
scripts/gerar-imagens.mjs  gera favicon e imagem Open Graph a partir do selo
```

As cores ficam em variáveis no topo de `src/styles/global.css`. O modo escuro segue a preferência do sistema de quem visita.

O favicon e a imagem de compartilhamento (`public/favicon.svg`, `favicon.png`, `apple-touch-icon.png` e `og.png`) já estão prontos. Só é preciso rodar `npm run imagens` de novo se o desenho do selo mudar.
