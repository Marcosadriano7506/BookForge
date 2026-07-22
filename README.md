# Guia Prático do DRCM Computação — edição digital

Experiência editorial estática do **Guia Prático do DRCM Computação**, por Marcos Adriano Marques Silva. O leitor usa imagens WebP locais; o PDF original permanece disponível apenas para abertura, download, impressão e acessibilidade alternativa. Não há backend, dependências JavaScript, fontes remotas ou rastreamento.

## Estrutura

- `book-config.js`: fonte única de metadados, caminhos, tema, paginação e capítulos;
- `index.html`, `style.css` e `script.js`: interface responsiva, temas e leitor;
- `assets/images/pages/page-001.webp` … `page-026.webp`: páginas da edição online;
- `assets/pdf/guia-drcm-computacao.pdf`: edição original, preservada;
- `tools/generate-pages.sh`: geração local das páginas;
- `render.yaml`: Static Site publicado a partir de `.`.

## Gerar as páginas WebP

O script requer `pdftoppm` (Poppler) e `cwebp`. Por padrão, gera páginas com 1600 px de largura e qualidade 84, preservando a proporção:

```bash
./tools/generate-pages.sh
```

É possível ajustar sem editar o script:

```bash
WIDTH=1800 QUALITY=86 ./tools/generate-pages.sh caminho/livro.pdf caminho/saida
```

O processo falha de forma explícita se as ferramentas, o PDF ou qualquer uma das 26 páginas estiverem ausentes. Ele não modifica o PDF original. Sem `page-001.webp`, o site mostra um fallback compacto e oferece apenas o PDF; sem o PDF, essas ações são desabilitadas com uma única mensagem coerente.

## Leitor

O modo de página única mantém apenas uma página no DOM, pré-carrega as vizinhas e oferece navegação, zoom de 70% a 200%, ajuste, tela cheia e gestos horizontais. O modo contínuo usa `loading="lazy"` e `IntersectionObserver`. Tema, página, modo, zoom e última leitura ficam apenas no `localStorage`.

O drawer inclui capítulos e miniaturas. Atalhos: setas para páginas, `Home`/`End`, `S` para sumário, `D` para tema, `F` para tela cheia, `Escape` para fechar e `Ctrl/Cmd + K` para pesquisar capítulos. Os atalhos são ignorados durante digitação.

## Execução e deploy

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`. O Render continua configurado como Static Site, com `runtime: static`, `staticPublishPath: .` e `autoDeployTrigger: commit`. A CSP bloqueia objetos, frames, scripts e recursos remotos.

`publicUrl` permanece vazio até a confirmação do domínio. Nesse estado, canonical e URL no JSON-LD são omitidos, e `robots.txt`/`sitemap.xml` não são alterados. Todo conteúdo variável deve ser editado exclusivamente em `book-config.js`.

## Impressão

Ao imprimir a página web, a interface é ocultada e uma folha simples orienta o uso de **Baixar PDF**. A edição completa deve ser impressa a partir do PDF original.
