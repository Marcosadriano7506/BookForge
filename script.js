'use strict';

(() => {
  const config = window.BOOK_CONFIG || (typeof BOOK_CONFIG !== 'undefined' ? BOOK_CONFIG : null);
  if (!config) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storageKeys = { theme: 'drcm-theme', progress: 'drcm-reading-progress' };
  const state = { currentPage: 1, imageMode: false, lastFocus: null, scrollQueued: false };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = {
    drawer: $('#tocDrawer'), scrim: $('#scrim'), tocOpen: $('#tocOpen'), chapterList: $('#chapterList'),
    searchDialog: $('#searchDialog'), searchInput: $('#searchInput'), results: $('#searchResults'), empty: $('#emptySearch'),
    pdf: $('#pdfReader'), missing: $('#missingPdf'), pages: $('#pagesReader'), shell: $('#readerShell'),
    progress: $('#progressBar'), percent: $('#percentRead'), indicator: $('#pageIndicator'), pageInput: $('#pageInput'),
    resume: $('#resumeBanner'), live: $('#liveRegion'), backTop: $('#backTop'), pdfStatus: $('#pdfStatus')
  };

  function announce(message) {
    elements.live.textContent = message;
    elements.live.classList.add('visible');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => elements.live.classList.remove('visible'), 2600);
  }

  function safeStorage(action, key, value) {
    try { return action === 'get' ? localStorage.getItem(key) : localStorage.setItem(key, value); }
    catch (_) { return null; }
  }

  function applyTheme(theme, notify = false) {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]').content = theme === 'dark' ? '#111815' : '#f5f1e8';
    safeStorage('set', storageKeys.theme, theme);
    if (notify) announce(`Tema ${theme === 'dark' ? 'escuro' : 'claro'} ativado.`);
  }

  function initializeTheme() {
    const saved = safeStorage('get', storageKeys.theme);
    applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }

  function createChapterControl(chapter, search = false) {
    const item = document.createElement('li');
    const control = document.createElement(search ? 'button' : 'a');
    if (!search) control.href = `#leitor`;
    control.dataset.page = chapter.page;
    const title = document.createElement('span');
    title.textContent = chapter.title;
    const page = document.createElement('small');
    page.textContent = `p. ${chapter.page}`;
    control.append(title, page);
    control.addEventListener('click', event => {
      event.preventDefault();
      goToPage(chapter.page);
      closeDrawer();
      if (elements.searchDialog.open) elements.searchDialog.close();
    });
    item.append(control);
    return item;
  }

  function renderChapters() {
    const fragment = document.createDocumentFragment();
    config.chapters.forEach(chapter => fragment.append(createChapterControl(chapter)));
    elements.chapterList.append(fragment);
    renderSearch('');
  }

  function renderSearch(query) {
    elements.results.replaceChildren();
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    const haystack = `${config.title} ${config.author} ${config.description}`.toLocaleLowerCase('pt-BR');
    const matches = config.chapters.filter(chapter => chapter.title.toLocaleLowerCase('pt-BR').includes(normalized) || (normalized && haystack.includes(normalized)));
    const fragment = document.createDocumentFragment();
    matches.forEach(chapter => fragment.append(createChapterControl(chapter, true)));
    elements.results.append(fragment);
    elements.empty.hidden = matches.length > 0;
  }

  function focusable(container) {
    return $$('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])', container).filter(node => !node.hidden);
  }

  function trapFocus(event, container) {
    if (event.key !== 'Tab') return;
    const nodes = focusable(container);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function openDrawer() {
    state.lastFocus = document.activeElement;
    elements.drawer.classList.add('open');
    elements.drawer.setAttribute('aria-hidden', 'false');
    elements.tocOpen.setAttribute('aria-expanded', 'true');
    elements.scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.close-control', elements.drawer).focus();
  }

  function closeDrawer() {
    if (!elements.drawer.classList.contains('open')) return;
    elements.drawer.classList.remove('open');
    elements.drawer.setAttribute('aria-hidden', 'true');
    elements.tocOpen.setAttribute('aria-expanded', 'false');
    elements.scrim.hidden = true;
    document.body.style.overflow = '';
    if (state.lastFocus) state.lastFocus.focus();
  }

  function openSearch() {
    closeDrawer();
    if (!elements.searchDialog.open) elements.searchDialog.showModal();
    elements.searchInput.value = '';
    renderSearch('');
    requestAnimationFrame(() => elements.searchInput.focus());
  }

  function setPage(page, scroll = false) {
    state.currentPage = Math.max(1, Math.min(config.totalPages, Number(page) || 1));
    elements.pageInput.value = state.currentPage;
    elements.pageInput.max = config.totalPages;
    elements.indicator.textContent = `Página ${state.currentPage} de ${config.totalPages}`;
    $$('#chapterList a').forEach(link => link.setAttribute('aria-current', Number(link.dataset.page) === state.currentPage ? 'page' : 'false'));
    if (state.imageMode && scroll) $(`[data-page="${state.currentPage}"]`, elements.pages)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    else if (scroll) {
      elements.pdf.data = `${config.pdfPath}#page=${state.currentPage}&view=FitH`;
      elements.shell.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function goToPage(page) { setPage(page, true); announce(`Página ${state.currentPage}.`); }

  async function resourceExists(path) {
    try { const response = await fetch(path, { method: 'HEAD', cache: 'no-store' }); return response.ok; }
    catch (_) { return false; }
  }

  function pagePath(page) { return `${config.pageImages.directory}/page-${String(page).padStart(3, '0')}.${config.pageImages.extension}`; }

  async function initializeReader() {
    const firstImageExists = await resourceExists(pagePath(1));
    if (firstImageExists) {
      state.imageMode = true;
      elements.pdf.hidden = true;
      elements.pages.hidden = false;
      const fragment = document.createDocumentFragment();
      for (let page = 1; page <= config.totalPages; page += 1) {
        const figure = document.createElement('figure'); figure.className = 'page-card'; figure.dataset.page = page;
        const image = document.createElement('img'); image.src = pagePath(page); image.alt = `Página ${page} de ${config.title}`; image.loading = page === 1 ? 'eager' : 'lazy'; image.decoding = 'async'; image.width = 1240; image.height = 1754;
        image.addEventListener('error', () => { figure.hidden = true; });
        const caption = document.createElement('figcaption'); caption.textContent = `Página ${page}`;
        figure.append(image, caption); fragment.append(figure);
      }
      elements.pages.append(fragment); observePages(); elements.pdfStatus.textContent = 'Leitura por páginas otimizada para este dispositivo.'; return;
    }
    const pdfExists = await resourceExists(config.pdfPath);
    if (!pdfExists) {
      elements.pdf.hidden = true; elements.missing.hidden = false; elements.pdfStatus.textContent = 'Configuração pendente: o arquivo PDF ainda não foi encontrado.';
      $$('.pdf-action').forEach(action => { action.setAttribute('aria-disabled', 'true'); action.removeAttribute('download'); action.addEventListener('click', event => event.preventDefault()); });
      announce('PDF não encontrado. Consulte as instruções de configuração.'); return;
    }
    elements.pdfStatus.textContent = 'PDF disponível para leitura online e impressão.';
    try {
      const response = await fetch(config.pdfPath, { method: 'HEAD' }); const bytes = Number(response.headers.get('content-length'));
      if (response.ok && bytes) elements.pdfStatus.textContent += ` ${new Intl.NumberFormat('pt-BR', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(bytes / 1048576)}.`;
    } catch (_) { /* O tamanho é complementar; falhas não interrompem a leitura. */ }
  }

  function observePages() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setPage(Number(visible.target.dataset.page));
    }, { threshold: [0.35, 0.65] });
    $$('.page-card', elements.pages).forEach(page => observer.observe(page));
  }

  function updateScrollProgress() {
    state.scrollQueued = false;
    const available = document.documentElement.scrollHeight - innerHeight;
    const percent = available > 0 ? Math.min(100, Math.max(0, scrollY / available * 100)) : 0;
    elements.progress.style.width = `${percent}%`;
    elements.percent.textContent = `${Math.round(percent)}% lido`;
    elements.backTop.hidden = scrollY < innerHeight;
    safeStorage('set', storageKeys.progress, JSON.stringify({ y: Math.round(scrollY), page: state.currentPage, savedAt: Date.now() }));
  }

  function onScroll() { if (!state.scrollQueued) { state.scrollQueued = true; requestAnimationFrame(updateScrollProgress); } }

  function restorePrompt() {
    let saved;
    try { saved = JSON.parse(safeStorage('get', storageKeys.progress)); } catch (_) { return; }
    if (saved && saved.y > 300) {
      elements.resume.hidden = false;
      $('#resumeButton').addEventListener('click', () => { setPage(saved.page || 1); scrollTo({ top: saved.y, behavior: reduceMotion ? 'auto' : 'smooth' }); elements.resume.hidden = true; announce('Posição de leitura restaurada.'); });
      $('#restartButton').addEventListener('click', () => { safeStorage('set', storageKeys.progress, ''); elements.resume.hidden = true; goToPage(1); });
    }
  }

  async function share() {
    const url = config.publicUrl || location.href;
    try {
      if (navigator.share) await navigator.share({ title: config.title, text: config.description, url });
      else { await navigator.clipboard.writeText(url); announce('Endereço copiado.'); }
    } catch (error) { if (error.name !== 'AbortError') announce('Não foi possível compartilhar. Copie o endereço do navegador.'); }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (elements.shell.requestFullscreen) await elements.shell.requestFullscreen();
      else announce('Tela cheia não é suportada neste navegador.');
    } catch (_) { announce('Não foi possível ativar a tela cheia.'); }
  }

  function isTyping(target) { return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable; }
  function onKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
    if (isTyping(event.target)) return;
    if (event.key === 'Escape') { closeDrawer(); if (elements.searchDialog.open) elements.searchDialog.close(); }
    else if (event.key.toLowerCase() === 'd') applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    else if (event.key.toLowerCase() === 's') openDrawer();
    else if (event.key.toLowerCase() === 'f') toggleFullscreen();
    else if (event.key === 'Home') { event.preventDefault(); scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    else if (event.key === 'End') { event.preventDefault(); scrollTo({ top: document.documentElement.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); scrollBy({ top: -160, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); scrollBy({ top: 160, behavior: reduceMotion ? 'auto' : 'smooth' }); }
  }

  function bindEvents() {
    elements.tocOpen.addEventListener('click', openDrawer); elements.scrim.addEventListener('click', closeDrawer); $('.close-control', elements.drawer).addEventListener('click', closeDrawer);
    elements.drawer.addEventListener('keydown', event => trapFocus(event, elements.drawer));
    $('#searchOpen').addEventListener('click', openSearch); $('#drawerSearch').addEventListener('click', openSearch); elements.searchInput.addEventListener('input', event => renderSearch(event.target.value));
    $('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
    $('#shareButton').addEventListener('click', share); $('#fullscreenButton').addEventListener('click', toggleFullscreen);
    $('#previousPage').addEventListener('click', () => goToPage(state.currentPage - 1)); $('#nextPage').addEventListener('click', () => goToPage(state.currentPage + 1));
    $('#pageForm').addEventListener('submit', event => { event.preventDefault(); goToPage(elements.pageInput.value); });
    elements.backTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    addEventListener('scroll', onScroll, { passive: true }); document.addEventListener('keydown', onKeydown);
  }

  initializeTheme(); renderChapters(); bindEvents(); restorePrompt(); initializeReader(); updateScrollProgress();
})();
