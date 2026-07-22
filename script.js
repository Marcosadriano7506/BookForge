'use strict';

(() => {
    const c = window.BOOK_CONFIG;

    if (!c) {
        console.error('BOOK_CONFIG não foi carregado.');
        return;
    }

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [
        ...root.querySelectorAll(selector)
    ];

    const STORAGE_VERSION = 2;

    const keys = {
        theme: 'bookforge-theme',
        reading: 'bookforge-reading'
    };

    function safeGet(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // O navegador pode bloquear localStorage em alguns modos privados.
        }
    }

    function readSavedState() {
        try {
            const parsed = JSON.parse(safeGet(keys.reading));

            if (!parsed || typeof parsed !== 'object') {
                return {};
            }

            return parsed;
        } catch {
            return {};
        }
    }

    const saved = readSavedState();

    const defaultMode =
        c.readingDefaults?.mode === 'continuous'
            ? 'continuous'
            : 'single';

    const defaultZoom =
        Number.isFinite(Number(c.readingDefaults?.zoom))
            ? Number(c.readingDefaults.zoom)
            : 100;

    const savedPage = Number(saved.page);
    const savedZoom = Number(saved.zoom);

    const state = {
        page:
            Number.isInteger(savedPage) &&
            savedPage >= 1 &&
            savedPage <= c.totalPages
                ? savedPage
                : 1,

        mode:
            saved.mode === 'continuous' || saved.mode === 'single'
                ? saved.mode
                : defaultMode,

        zoom:
            Number.isFinite(savedZoom)
                ? savedZoom
                : defaultZoom,

        ready: false,
        pdf: false,
        lastFocus: null,
        retry: 0,
        observer: null,
        saveTimer: null
    };

    const el = {
        drawer: $('#tocDrawer'),
        scrim: $('#scrim'),
        single: $('#singleStage'),
        image: $('#singleImage'),
        continuous: $('#continuousReader'),
        fallback: $('#onlineFallback'),
        loading: $('#readerLoading'),
        controls: $('#readerControls'),
        prev: $('#previousPage'),
        next: $('#nextPage'),
        input: $('#pageInput'),
        indicator: $('#pageIndicator'),
        percent: $('#percentRead'),
        progress: $('#progressBar'),
        live: $('#liveRegion'),
        error: $('#pageError')
    };

    function imagePath(page) {
        const safePage = Math.max(
            1,
            Math.min(c.totalPages, Number(page) || 1)
        );

        const fileNumber = String(safePage).padStart(
            c.pageImages.digits,
            '0'
        );

        const fileName = c.pageImages.filenamePattern.replace(
            '{page}',
            fileNumber
        );

        return `${c.pageImages.directory}/${fileName}`;
    }

    function syncMetadata() {
        document.title = `${c.title} — Edição Digital`;

        const textMap = {
            '[data-title]': c.title,
            '[data-short-title]': c.shortTitle,
            '[data-author]': c.author,
            '[data-year]': c.year,
            '[data-total]': c.totalPages,
            '[data-description]': c.description
        };

        Object.entries(textMap).forEach(([selector, value]) => {
            $$(selector).forEach((node) => {
                node.textContent = value ?? '';
            });
        });

        const metadata = [
            ['meta[name="description"]', c.description],
            ['meta[name="author"]', c.author],
            ['meta[property="og:title"]', c.title],
            ['meta[property="og:description"]', c.description],
            ['meta[name="twitter:title"]', c.title],
            ['meta[name="twitter:description"]', c.description]
        ];

        metadata.forEach(([selector, value]) => {
            const node = $(selector);

            if (node) {
                node.content = value ?? '';
            }
        });

        const canonical = $('#canonical');

        if (canonical) {
            if (c.publicUrl) {
                canonical.href = c.publicUrl;
            } else {
                canonical.remove();
            }
        }

        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: c.title,
            author: {
                '@type': 'Person',
                name: c.author
            },
            description: c.description,
            datePublished: String(c.year),
            inLanguage: 'pt-BR',
            bookFormat: 'https://schema.org/EBook',
            numberOfPages: c.totalPages
        };

        if (c.publicUrl) {
            structuredData.url = c.publicUrl;
        }

        if (c.publisher) {
            structuredData.publisher = {
                '@type': 'Organization',
                name: c.publisher
            };
        }

        const metadataScript = $('#bookMetadata');

        if (metadataScript) {
            metadataScript.textContent = JSON.stringify(structuredData);
        }

        $$('.pdf-download, .pdf-open').forEach((link) => {
            link.href = c.pdfPath;
        });

        const printPdf = $('#printPdf');

        if (printPdf) {
            printPdf.href = c.pdfPath;
            printPdf.textContent = c.pdfPath;
        }

        const coverImage = $('#coverImage');

        if (coverImage) {
            coverImage.alt = `Capa de ${c.title}`;
        }
    }

    async function fileExists(url, expectedType = '') {
        try {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store'
            });

            if (!response.ok) {
                return false;
            }

            const contentType = (
                response.headers.get('content-type') || ''
            ).toLowerCase();

            if (contentType.includes('text/html')) {
                return false;
            }

            if (
                expectedType &&
                contentType &&
                !contentType.includes(expectedType)
            ) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    function announce(text) {
        if (!el.live) {
            return;
        }

        el.live.textContent = text;
        el.live.classList.add('visible');

        clearTimeout(announce.timer);

        announce.timer = setTimeout(() => {
            el.live.classList.remove('visible');
        }, 2200);
    }

    function saveReadingState() {
        clearTimeout(state.saveTimer);

        state.saveTimer = setTimeout(() => {
            safeSet(
                keys.reading,
                JSON.stringify({
                    storageVersion: STORAGE_VERSION,
                    page: state.page,
                    mode: state.mode,
                    zoom: state.zoom,
                    lastRead: new Date().toISOString()
                })
            );
        }, 250);
    }

    function applyTheme(theme, notify = false) {
        const selectedTheme =
            theme === 'dark'
                ? 'dark'
                : 'light';

        document.documentElement.dataset.theme = selectedTheme;
        safeSet(keys.theme, selectedTheme);

        const themeMeta = $('meta[name="theme-color"]');

        if (themeMeta) {
            themeMeta.content =
                selectedTheme === 'dark'
                    ? c.theme.dark
                    : c.theme.light;
        }

        if (notify) {
            announce(
                `Tema ${
                    selectedTheme === 'dark'
                        ? 'escuro'
                        : 'claro'
                } ativado.`
            );
        }
    }

    function normalizePage(page) {
        return Math.max(
            1,
            Math.min(
                c.totalPages,
                Math.round(Number(page) || 1)
            )
        );
    }

    function updateReaderStatus() {
        state.page = normalizePage(state.page);

        const percentage = Math.round(
            (state.page / c.totalPages) * 100
        );

        if (el.input) {
            el.input.value = state.page;
        }

        if (el.indicator) {
            el.indicator.textContent =
                `Página ${state.page} de ${c.totalPages}`;
        }

        if (el.percent) {
            el.percent.textContent = `${percentage}% lido`;
        }

        if (el.progress) {
            el.progress.style.width = `${percentage}%`;
        }

        if (el.prev) {
            el.prev.disabled = state.page === 1;
        }

        if (el.next) {
            el.next.disabled =
                state.page === c.totalPages;
        }

        $$('#chapterList button').forEach((button) => {
            if (Number(button.dataset.page) === state.page) {
                button.setAttribute(
                    'aria-current',
                    'page'
                );
            } else {
                button.removeAttribute('aria-current');
            }
        });

        saveReadingState();
    }

    function showPageError() {
        if (el.image) {
            el.image.removeAttribute('src');
            el.image.hidden = true;
        }

        if (el.error) {
            el.error.hidden = false;
        }

        announce(
            `Não foi possível carregar a página ${state.page}.`
        );
    }

    function preloadPage(page) {
        if (page < 1 || page > c.totalPages) {
            return;
        }

        const image = new Image();
        image.decoding = 'async';
        image.src = imagePath(page);
    }

    function loadSinglePage() {
        if (!el.image) {
            console.error(
                'O elemento #singleImage não foi encontrado.'
            );
            return;
        }

        state.page = normalizePage(state.page);
        state.retry = 0;

        if (el.error) {
            el.error.hidden = true;
        }

        el.image.hidden = false;
        el.image.style.opacity = '1';
        el.image.style.visibility = 'visible';
        el.image.style.display = 'block';
        el.image.alt =
            `Página ${state.page} de ${c.title}`;

        const pageAtRequest = state.page;

        const assignImage = (source) => {
            el.image.onload = () => {
                if (pageAtRequest !== state.page) {
                    return;
                }

                el.image.hidden = false;
                el.image.style.opacity = '1';
                el.image.style.visibility = 'visible';
                el.image.style.display = 'block';

                if (el.error) {
                    el.error.hidden = true;
                }

                preloadPage(state.page - 1);
                preloadPage(state.page + 1);
            };

            el.image.onerror = () => {
                if (pageAtRequest !== state.page) {
                    return;
                }

                if (state.retry < 1) {
                    state.retry += 1;

                    window.setTimeout(() => {
                        assignImage(
                            `${imagePath(state.page)}?retry=${Date.now()}`
                        );
                    }, 300);

                    return;
                }

                showPageError();
            };

            el.image.src = source;
        };

        assignImage(imagePath(state.page));
    }

    function goToPage(page, notify = true) {
        state.page = normalizePage(page);

        updateReaderStatus();

        if (state.mode === 'single') {
            loadSinglePage();
        } else {
            const currentFigure = document.querySelector(
                `[data-continuous-page="${state.page}"]`
            );

            if (currentFigure) {
                const reducedMotion = window.matchMedia(
                    '(prefers-reduced-motion: reduce)'
                ).matches;

                currentFigure.scrollIntoView({
                    behavior: reducedMotion
                        ? 'auto'
                        : 'smooth'
                });
            }
        }

        if (notify) {
            announce(
                `Página ${state.page} de ${c.totalPages}.`
            );
        }
    }

    function renderContinuousReader() {
        if (!el.continuous) {
            return;
        }

        el.continuous.replaceChildren();

        const fragment =
            document.createDocumentFragment();

        for (
            let page = 1;
            page <= c.totalPages;
            page += 1
        ) {
            const figure =
                document.createElement('figure');

            const image =
                document.createElement('img');

            const caption =
                document.createElement('figcaption');

            figure.dataset.continuousPage = page;

            image.loading =
                page === state.page
                    ? 'eager'
                    : 'lazy';

            image.decoding = 'async';
            image.width = 1600;
            image.height = 2263;
            image.alt =
                `Página ${page} de ${c.title}`;
            image.src = imagePath(page);

            image.onerror = () => {
                image.removeAttribute('src');
                figure.hidden = true;
            };

            caption.textContent = `Página ${page}`;

            figure.append(image, caption);
            fragment.append(figure);
        }

        el.continuous.append(fragment);

        if ('IntersectionObserver' in window) {
            if (state.observer) {
                state.observer.disconnect();
            }

            state.observer = new IntersectionObserver(
                (entries) => {
                    const visible = entries
                        .filter(
                            (entry) =>
                                entry.isIntersecting
                        )
                        .sort(
                            (a, b) =>
                                b.intersectionRatio -
                                a.intersectionRatio
                        )[0];

                    if (!visible) {
                        return;
                    }

                    state.page = Number(
                        visible.target.dataset
                            .continuousPage
                    );

                    updateReaderStatus();
                },
                {
                    threshold: [0.4, 0.7]
                }
            );

            $$(
                'figure',
                el.continuous
            ).forEach((figure) => {
                state.observer.observe(figure);
            });
        }
    }

    function setMode(mode) {
        state.mode =
            mode === 'continuous'
                ? 'continuous'
                : 'single';

        if (el.single) {
            el.single.hidden =
                state.mode !== 'single';
        }

        if (el.continuous) {
            el.continuous.hidden =
                state.mode !== 'continuous';
        }

        const modeButton = $('#modeToggle');

        if (modeButton) {
            modeButton.textContent =
                state.mode === 'single'
                    ? 'Modo contínuo'
                    : 'Página única';
        }

        if (state.mode === 'continuous') {
            renderContinuousReader();

            window.setTimeout(() => {
                goToPage(state.page, false);
            }, 50);
        } else {
            loadSinglePage();
        }

        updateReaderStatus();
    }

    function setZoom(value) {
        const number = Number(value);

        state.zoom = Math.max(
            70,
            Math.min(
                200,
                Number.isFinite(number)
                    ? number
                    : defaultZoom
            )
        );

        if (el.image) {
            el.image.style.setProperty(
                '--zoom',
                state.zoom / 100
            );
        }

        const zoomLabel = $('#zoomLabel');

        if (zoomLabel) {
            zoomLabel.textContent =
                `${state.zoom}%`;
        }

        saveReadingState();
    }

    function openDrawer() {
        if (!el.drawer) {
            return;
        }

        state.lastFocus = document.activeElement;

        el.drawer.classList.add('open');
        el.drawer.setAttribute(
            'aria-hidden',
            'false'
        );

        $('#tocOpen')?.setAttribute(
            'aria-expanded',
            'true'
        );

        if (el.scrim) {
            el.scrim.hidden = false;
        }

        document.body.style.overflow = 'hidden';

        $('#tocClose')?.focus();
    }

    function closeDrawer() {
        if (
            !el.drawer ||
            !el.drawer.classList.contains('open')
        ) {
            return;
        }

        el.drawer.classList.remove('open');
        el.drawer.setAttribute(
            'aria-hidden',
            'true'
        );

        $('#tocOpen')?.setAttribute(
            'aria-expanded',
            'false'
        );

        if (el.scrim) {
            el.scrim.hidden = true;
        }

        document.body.style.overflow = '';

        if (
            state.lastFocus &&
            typeof state.lastFocus.focus === 'function'
        ) {
            state.lastFocus.focus();
        }
    }

    function buildChapters() {
        const chapterList = $('#chapterList');

        if (
            chapterList &&
            Array.isArray(c.chapters)
        ) {
            const fragment =
                document.createDocumentFragment();

            c.chapters.forEach((chapter) => {
                const item =
                    document.createElement('li');

                const button =
                    document.createElement('button');

                const title =
                    document.createElement('span');

                const page =
                    document.createElement('small');

                button.dataset.page = chapter.page;
                title.textContent = chapter.title;
                page.textContent = `p. ${chapter.page}`;

                button.append(title, page);

                button.addEventListener(
                    'click',
                    () => {
                        goToPage(chapter.page);
                        closeDrawer();
                    }
                );

                item.append(button);
                fragment.append(item);
            });

            chapterList.append(fragment);
        }

        const thumbnailList =
            $('#thumbnailList');

        if (!thumbnailList) {
            return;
        }

        const thumbnailFragment =
            document.createDocumentFragment();

        for (
            let page = 1;
            page <= c.totalPages;
            page += 1
        ) {
            const item =
                document.createElement('li');

            const button =
                document.createElement('button');

            const image =
                document.createElement('img');

            const label =
                document.createElement('small');

            image.loading = 'lazy';
            image.width = 160;
            image.height = 226;
            image.alt = '';
            image.src = imagePath(page);

            image.onerror = () => {
                image.removeAttribute('src');
                image.hidden = true;
            };

            label.textContent = `Página ${page}`;

            button.append(image, label);

            button.addEventListener(
                'click',
                () => {
                    goToPage(page);
                    closeDrawer();
                }
            );

            item.append(button);
            thumbnailFragment.append(item);
        }

        thumbnailList.append(thumbnailFragment);
    }

    function setDrawerTab(showPages) {
        $('#chaptersTab')?.setAttribute(
            'aria-selected',
            String(!showPages)
        );

        $('#pagesTab')?.setAttribute(
            'aria-selected',
            String(showPages)
        );

        const chaptersPanel =
            $('#chaptersPanel');

        const pagesPanel =
            $('#pagesPanel');

        if (chaptersPanel) {
            chaptersPanel.hidden = showPages;
        }

        if (pagesPanel) {
            pagesPanel.hidden = !showPages;
        }
    }

    async function shareBook() {
        const data = {
            title: c.title,
            text: c.description,
            url: c.publicUrl || window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(data);
                return;
            }

            if (navigator.clipboard) {
                await navigator.clipboard.writeText(
                    data.url
                );

                announce('Endereço copiado.');
                return;
            }

            window.prompt(
                'Copie o endereço:',
                data.url
            );
        } catch (error) {
            if (error?.name !== 'AbortError') {
                announce(
                    'Não foi possível compartilhar.'
                );
            }
        }
    }

    function trapDrawerFocus(event) {
        if (
            event.key !== 'Tab' ||
            !el.drawer
        ) {
            return;
        }

        const focusable = $$(
            'button, input, a[href]',
            el.drawer
        ).filter(
            (node) =>
                !node.closest('[hidden]') &&
                !node.disabled
        );

        if (!focusable.length) {
            return;
        }

        const first = focusable[0];
        const last =
            focusable[focusable.length - 1];

        if (
            event.shiftKey &&
            document.activeElement === first
        ) {
            event.preventDefault();
            last.focus();
        } else if (
            !event.shiftKey &&
            document.activeElement === last
        ) {
            event.preventDefault();
            first.focus();
        }
    }

    function bindEvents() {
        const menuToggle = $('#menuToggle');

        if (menuToggle) {
            menuToggle.addEventListener(
                'click',
                () => {
                    const navigation =
                        $('#mainNav');

                    if (!navigation) {
                        return;
                    }

                    const open =
                        !navigation.classList.contains(
                            'open'
                        );

                    navigation.classList.toggle(
                        'open',
                        open
                    );

                    menuToggle.setAttribute(
                        'aria-expanded',
                        String(open)
                    );
                }
            );
        }

        $('#tocOpen')?.addEventListener(
            'click',
            openDrawer
        );

        $('#readerToc')?.addEventListener(
            'click',
            openDrawer
        );

        $('#tocClose')?.addEventListener(
            'click',
            closeDrawer
        );

        el.scrim?.addEventListener(
            'click',
            closeDrawer
        );

        el.drawer?.addEventListener(
            'keydown',
            trapDrawerFocus
        );

        $('#chaptersTab')?.addEventListener(
            'click',
            () => setDrawerTab(false)
        );

        $('#pagesTab')?.addEventListener(
            'click',
            () => setDrawerTab(true)
        );

        $('#chapterSearch')?.addEventListener(
            'input',
            (event) => {
                const search =
                    event.target.value
                        .toLowerCase()
                        .trim();

                $$('#chapterList li').forEach(
                    (item) => {
                        item.hidden =
                            !item.textContent
                                .toLowerCase()
                                .includes(search);
                    }
                );
            }
        );

        el.prev?.addEventListener(
            'click',
            () => goToPage(state.page - 1)
        );

        el.next?.addEventListener(
            'click',
            () => goToPage(state.page + 1)
        );

        $('#pageForm')?.addEventListener(
            'submit',
            (event) => {
                event.preventDefault();
                goToPage(el.input?.value);
            }
        );

        $('#zoomOut')?.addEventListener(
            'click',
            () => setZoom(state.zoom - 10)
        );

        $('#zoomIn')?.addEventListener(
            'click',
            () => setZoom(state.zoom + 10)
        );

        $('#zoomReset')?.addEventListener(
            'click',
            () => setZoom(100)
        );

        $('#fitWidth')?.addEventListener(
            'click',
            () => setZoom(100)
        );

        $('#modeToggle')?.addEventListener(
            'click',
            () => {
                setMode(
                    state.mode === 'single'
                        ? 'continuous'
                        : 'single'
                );
            }
        );

        $('#themeToggle')?.addEventListener(
            'click',
            () => {
                applyTheme(
                    document.documentElement
                        .dataset.theme === 'dark'
                        ? 'light'
                        : 'dark',
                    true
                );
            }
        );

        $('#shareButton')?.addEventListener(
            'click',
            shareBook
        );

        $('#aboutShare')?.addEventListener(
            'click',
            shareBook
        );

        $('#fullscreenButton')?.addEventListener(
            'click',
            async () => {
                try {
                    if (document.fullscreenElement) {
                        await document.exitFullscreen();
                    } else {
                        await $('#readerShell')
                            ?.requestFullscreen?.();
                    }
                } catch {
                    announce(
                        'Tela cheia não disponível neste navegador.'
                    );
                }
            }
        );

        window.addEventListener(
            'scroll',
            () => {
                $('.topbar')?.classList.toggle(
                    'scrolled',
                    window.scrollY > 24
                );
            },
            {
                passive: true
            }
        );

        document.addEventListener(
            'keydown',
            (event) => {
                const target = event.target;

                if (
                    target &&
                    (
                        /INPUT|TEXTAREA|SELECT/.test(
                            target.tagName
                        ) ||
                        target.isContentEditable
                    )
                ) {
                    return;
                }

                if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key.toLowerCase() === 'k'
                ) {
                    event.preventDefault();
                    openDrawer();
                    $('#chapterSearch')?.focus();
                } else if (event.key === 'Escape') {
                    closeDrawer();
                } else if (
                    event.key === 'ArrowLeft'
                ) {
                    goToPage(state.page - 1);
                } else if (
                    event.key === 'ArrowRight'
                ) {
                    goToPage(state.page + 1);
                } else if (event.key === 'Home') {
                    event.preventDefault();
                    goToPage(1);
                } else if (event.key === 'End') {
                    event.preventDefault();
                    goToPage(c.totalPages);
                } else if (
                    event.key.toLowerCase() === 's'
                ) {
                    openDrawer();
                } else if (
                    event.key.toLowerCase() === 'd'
                ) {
                    $('#themeToggle')?.click();
                } else if (
                    event.key.toLowerCase() === 'f'
                ) {
                    $('#fullscreenButton')?.click();
                }
            }
        );

        const readerShell = $('#readerShell');

        if (readerShell) {
            let startX = null;
            let startY = null;

            readerShell.addEventListener(
                'touchstart',
                (event) => {
                    const touch =
                        event.touches?.[0];

                    if (!touch) {
                        return;
                    }

                    startX = touch.clientX;
                    startY = touch.clientY;
                },
                {
                    passive: true
                }
            );

            readerShell.addEventListener(
                'touchend',
                (event) => {
                    const touch =
                        event.changedTouches?.[0];

                    if (
                        !touch ||
                        startX === null ||
                        startY === null
                    ) {
                        return;
                    }

                    const differenceX =
                        touch.clientX - startX;

                    const differenceY =
                        touch.clientY - startY;

                    if (
                        Math.abs(differenceX) > 65 &&
                        Math.abs(differenceX) >
                            Math.abs(differenceY) * 1.5
                    ) {
                        goToPage(
                            state.page +
                                (
                                    differenceX < 0
                                        ? 1
                                        : -1
                                )
                        );
                    }

                    startX = null;
                    startY = null;
                },
                {
                    passive: true
                }
            );
        }
    }

    function configureCover() {
        const cover = $('#coverImage');
        const skeleton = $('#coverSkeleton');

        if (!cover) {
            return;
        }

        cover.onload = () => {
            if (skeleton) {
                skeleton.hidden = true;
            }

            cover.hidden = false;
        };

        cover.onerror = () => {
            cover.removeAttribute('src');
            cover.hidden = true;

            if (skeleton) {
                skeleton.hidden = false;
            }
        };

        cover.src = c.coverImage;
    }

    function configureResumeBanner() {
        const banner = $('#resumeBanner');

        if (!banner) {
            return;
        }

        banner.hidden = true;

        if (
            state.page < 2 ||
            state.page > c.totalPages
        ) {
            return;
        }

        const resumePage = $('#resumePage');

        if (resumePage) {
            resumePage.textContent =
                String(state.page);
        }

        banner.hidden = false;

        $('#resumeButton')?.addEventListener(
            'click',
            () => {
                banner.hidden = true;
                goToPage(state.page);
            }
        );

        $('#restartButton')?.addEventListener(
            'click',
            () => {
                banner.hidden = true;
                goToPage(1);
            }
        );

        $('#dismissResume')?.addEventListener(
            'click',
            () => {
                banner.hidden = true;
            }
        );
    }

    async function configurePdf() {
        if (!c.pdfPath) {
            return;
        }

        const pdfExists = await fileExists(
            c.pdfPath,
            'application/pdf'
        );

        state.pdf = pdfExists;

        if (pdfExists) {
            return;
        }

        $$('.pdf-download, .pdf-open').forEach(
            (link) => {
                link.removeAttribute('href');
                link.setAttribute(
                    'aria-disabled',
                    'true'
                );
            }
        );

        const pdfMissing = $('#pdfMissing');

        if (pdfMissing) {
            pdfMissing.hidden = false;
        }
    }

    async function init() {
        try {
            syncMetadata();
            buildChapters();
            bindEvents();
            configureCover();

            const preferredTheme =
                safeGet(keys.theme) ||
                (
                    window.matchMedia(
                        '(prefers-color-scheme: dark)'
                    ).matches
                        ? 'dark'
                        : 'light'
                );

            applyTheme(preferredTheme);

            if (el.loading) {
                el.loading.hidden = true;
            }

            if (el.fallback) {
                el.fallback.hidden = true;
            }

            if (el.controls) {
                el.controls.hidden = false;
            }

            /*
             * O leitor não depende mais de uma requisição HEAD
             * ou Range para decidir se as páginas existem.
             *
             * Isso evita falhas em Safari e Chrome no iPhone.
             */
            state.ready = true;

            setMode(state.mode);
            setZoom(state.zoom);
            configureResumeBanner();

            /*
             * A existência do PDF é verificada sem bloquear
             * o carregamento das páginas do livro.
             */
            configurePdf();
        } catch (error) {
            console.error(
                'Erro ao inicializar o BookForge:',
                error
            );

            if (el.loading) {
                el.loading.hidden = true;
            }

            if (el.fallback) {
                el.fallback.hidden = false;
            }

            if (el.indicator) {
                el.indicator.textContent =
                    'Não foi possível iniciar o leitor';
            }
        }
    }

    init();
})();
