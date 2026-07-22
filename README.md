# Guia Prático do DRCM Computação — edição digital

Edição editorial estática, acessível e responsiva do **Guia Prático do DRCM Computação**. O livro pode ser lido no visualizador nativo de PDF do navegador ou, quando fornecidas, em imagens de página. Não há backend, banco, cookies, rastreamento, dependências externas ou etapa obrigatória de build.

## Tecnologias e estrutura

HTML5 semântico, CSS3, JavaScript puro, SVG de texto e APIs nativas do navegador.

```text
/
├── index.html                 # estrutura, SEO e leitor
├── style.css                  # identidade, temas e responsividade
├── script.js                  # interação e progressive enhancement
├── book-config.js             # metadados, caminhos, capítulos e páginas
├── render.yaml                # Blueprint do Render e cabeçalhos
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── README.md
└── assets/
    ├── icons/                 # favicon e cartão social SVG
    ├── images/                # imagens opcionais
    ├── fonts/                 # reservado para fontes locais opcionais
    └── pdf/
        └── guia-drcm-computacao.pdf
```

Os `.gitkeep` preservam diretórios vazios. Nenhum pacote ou gerenciador de pacotes é necessário.

## Livro e configuração

### Adicionar ou substituir o PDF

Coloque o arquivo, sem converter ou compactar, exatamente em:

```text
assets/pdf/guia-drcm-computacao.pdf
```

Para substituir o livro, troque esse arquivo e revise `title`, `author`, `description`, `totalPages`, `pdfPath` e `chapters` em `book-config.js`, além dos metadados e JSON-LD de `index.html`. O leitor faz uma requisição `HEAD`: se o PDF não estiver disponível, mostra um aviso, oculta apenas o leitor e desabilita as ações dependentes dele. Servidores que não retornam `Content-Length` continuam funcionando, apenas sem exibir o tamanho.

### Editar capítulos

Todos os números editoriais ficam em `BOOK_CONFIG.chapters`, no formato `{ title: 'Título', page: 1 }`. Os valores atuais são conservadores e **devem ser conferidos contra a paginação final do PDF**. Atualize também `totalPages`. O sumário, a pesquisa e o campo “Ir para” consomem essa configuração.

### Adicionar imagens de páginas

Crie `assets/images/pages/` e exporte uma imagem por página, sem lacunas:

```text
page-001.webp
page-002.webp
…
```

A quantidade esperada vem de `totalPages`; diretório e extensão ficam em `pageImages`. Quando `page-001.webp` existe, o site seleciona automaticamente o modo de páginas, usa carregamento lazy, reserva proporção, sincroniza a página visível e esconde imagens individuais que falharem. Sem a primeira imagem, usa o PDF incorporado. Em hospedagem com fallback HTML indevido para arquivos ausentes, confirme que respostas 404 mantêm o status HTTP correto.

### Metadados e URL pública

Edite os campos em `book-config.js`. Após o primeiro deploy, preencha `publicUrl` com a URL completa e real do Render, sem inventar domínio. Atualize também:

- a URL `SEU-SITE` em `sitemap.xml`;
- a linha `Sitemap` em `robots.txt` e remova o comentário;
- metadados de autoria e JSON-LD em `index.html`, se necessário.

A imagem social padrão é o SVG textual `assets/icons/social-card.svg`; substitua a referência por uma imagem já existente se a plataforma social não aceitar SVG.

## Execução local

Abrir `index.html` diretamente apresenta a interface, mas navegadores normalmente bloqueiam `fetch` e alguns recursos de PDF sob `file://`. Para testar o comportamento real, use qualquer servidor estático disponível, por exemplo:

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000/`. Não há rota SPA nem servidor especial.

## Publicação no Render

### Pela interface

1. Conecte sua conta do **GitHub** ao Render.
2. Selecione **New > Static Site**.
3. Escolha o repositório **BookForge**.
4. Selecione a branch **main**.
5. Deixe **Build Command** vazio (ou use o comando mínimo seguro `true` se o painel exigir).
6. Defina **Publish Directory** como `.`.
7. Crie o serviço e realize o deploy.
8. Copie a URL real terminada em `onrender.com`.
9. Atualize `publicUrl` em `book-config.js` e os arquivos de descoberta descritos acima.
10. Faça um novo commit; com auto deploy habilitado, o Render publicará a atualização.

O `render.yaml` oferece a alternativa Blueprint, com raiz como diretório publicado, sem build e com auto deploy. Os cabeçalhos impedem sniffing, reduzem referrer e desabilitam permissões não utilizadas. A CSP permite apenas recursos locais, o SVG local e o PDF incorporado; se o provedor mudar o modo de exibição de PDFs, valide a CSP após o deploy.

## Recursos e acessibilidade

- tema claro/escuro persistente e preferência do sistema;
- sumário lateral com foco contido, retorno de foco e `aria-current`;
- pesquisa acessível somente sobre capítulos e metadados (`Ctrl/Command + K`);
- progresso, percentual, página atual, anterior/próxima e página específica;
- posição aproximada persistida, restaurada apenas após confirmação;
- compartilhar via Web Share ou copiar endereço;
- tela cheia quando a API existir;
- skip link, landmarks, foco visível, áreas de toque e avisos `aria-live`;
- suporte a `prefers-reduced-motion`, `prefers-contrast`, modo escuro e safe areas;
- atalhos `Home`, `End`, setas, `Escape`, `D`, `S` e `F`, ignorados durante digitação.

A acessibilidade interna do documento incorporado depende da marcação do próprio PDF e do visualizador do navegador. O fallback oferece abertura e download, mas não reproduz texto do livro no DOM.

## Pesquisa: limitação intencional

“Pesquisar capítulos” consulta títulos e metadados configurados. Não promete pesquisar o conteúdo interno do PDF, porque esse texto pode não estar disponível no DOM. Os resultados aceitam teclado, fecham com `Escape` e levam à página configurada.

## Segurança e privacidade

O projeto não usa `eval`, `Function`, scripts remotos, analytics, cookies, permissões ou armazenamento sensível. Dados configurados entram no DOM via `textContent`; links externos/fallback usam `noopener noreferrer`. `localStorage` guarda apenas tema e posição aproximada. Revise os cabeçalhos de `render.yaml` no painel depois do deploy.

## Diagnóstico do PDF ausente

1. Confirme nome, caixa e caminho exatos com `test -f assets/pdf/guia-drcm-computacao.pdf`.
2. Abra a aba Network do navegador e procure a requisição `HEAD` ao PDF.
3. Um `404` ativa corretamente o aviso de configuração pendente.
4. Se o host responder `200` com HTML para caminhos inexistentes, remova rewrites/fallbacks SPA.
5. Se o PDF existe mas não incorpora, teste “Abrir PDF”; extensões e políticas do navegador podem desabilitar o visualizador nativo.

## Checklist de deploy

- [ ] PDF presente e não modificado pelo fluxo de publicação.
- [ ] `totalPages` e páginas dos capítulos conferidos.
- [ ] autoria e descrição finais preenchidas.
- [ ] nenhum segredo ou tracker incluído.
- [ ] caminhos relativos e capitalização verificados.
- [ ] `publicUrl`, sitemap e robots atualizados depois do primeiro deploy.
- [ ] teste local em 320 px, 768 px e 1440 px.
- [ ] teste de teclado, foco, modo escuro e movimento reduzido.

## Checklist pós-deploy

- [ ] página inicial, PDF, manifest, SVG e sitemap retornam `200` e MIME adequado.
- [ ] download, incorporação, fallback e compartilhamento funcionam.
- [ ] cabeçalhos de segurança estão presentes sem bloquear o PDF.
- [ ] URL social e cartão de compartilhamento foram validados na plataforma-alvo.
- [ ] posição de leitura oferece confirmação antes de restaurar.
- [ ] Lighthouse e validador HTML executados; registre os resultados reais sem prometer nota específica.
