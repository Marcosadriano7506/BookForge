# BookForge

Base estática de uma plataforma que transformará arquivos PDF em livros digitais modernos, responsivos e agradáveis de ler.

> **Status:** estrutura inicial. A leitura, o download e a conversão de PDFs ainda não estão implementados.

## Tecnologias

- HTML5 semântico;
- CSS3 responsivo;
- JavaScript puro (Vanilla JS).

O projeto não utiliza frameworks, bibliotecas externas, Node.js, gerenciadores de pacotes ou processo de build.

## Estrutura

```text
/
├── index.html
├── style.css
├── script.js
├── README.md
├── .gitignore
├── favicon.ico
└── assets/
    ├── images/
    ├── pdf/
    ├── icons/
    └── fonts/
```

As pastas em `assets/` incluem arquivos `.gitkeep` para que permaneçam no repositório enquanto estiverem vazias.

## Executar localmente

Como não há compilação, você pode abrir `index.html` diretamente em um navegador. Para simular um servidor estático, também pode usar qualquer servidor HTTP disponível no seu ambiente, por exemplo:

```bash
python3 -m http.server 8000
```

Depois, acesse `http://localhost:8000`.

## Publicar no Render

1. No painel do Render, selecione **New > Static Site**.
2. Conecte o repositório do BookForge.
3. Mantenha o campo **Build Command** vazio.
4. Informe `.` em **Publish Directory**.
5. Crie o serviço e aguarde a publicação.

Como todos os caminhos são relativos e não existe etapa de build, a raiz do repositório pode ser publicada diretamente.

## Organização do código

- `index.html`: estrutura e conteúdo semântico da página;
- `style.css`: identidade visual, layout e adaptações responsivas;
- `script.js`: ponto de entrada reservado para comportamentos futuros;
- `assets/`: imagens, PDFs, ícones e fontes locais.

## Escopo atual

Os botões **Ler Livro** e **Baixar PDF** representam as ações planejadas, mas permanecem desabilitados. Isso evita simular recursos que ainda não existem. A implementação da leitura e da conversão de PDFs não faz parte desta etapa.
