'use strict';

const BOOK_CONFIG = Object.freeze({
  title: 'Guia Prático do DRCM Computação',
  shortTitle: 'Guia DRCM',
  author: 'Marcos Adriano Marques Silva',
  publisher: '',
  year: 2026,
  description: 'Orientações práticas para compreender e ensinar Computação.',
  pdfPath: 'assets/pdf/guia-drcm-computacao.pdf',
  publicUrl: '',
  totalPages: 26,
  coverImage: 'assets/images/pages/page-001.webp',
  pageImages: { directory: 'assets/images/pages', extension: 'webp', filenamePattern: 'page-{page}.webp', digits: 3 },
  theme: { light: '#f5f2e9', dark: '#14201b', accent: '#285d49' },
  readingDefaults: { mode: 'single', zoom: 100 },
  chapters: [
    { title: 'Capa', page: 1 }, { title: 'Mensagem ao leitor', page: 2 },
    { title: 'Sumário', page: 3 }, { title: 'O que é o DRCM Computação', page: 4 },
    { title: 'Por que ensinar Computação', page: 6 }, { title: 'Eixos estruturantes', page: 8 },
    { title: 'Competências e habilidades', page: 10 }, { title: 'Organização por etapas', page: 12 },
    { title: 'Práticas pedagógicas', page: 14 }, { title: 'Projetos', page: 17 },
    { title: 'Recursos', page: 19 }, { title: 'Desafios', page: 21 },
    { title: 'Considerações finais', page: 24 }, { title: 'Referências', page: 26 }
  ]
});

window.BOOK_CONFIG = BOOK_CONFIG;
