// 테마 · 사이드바 · 내비 팔레트 · 탭/태그 soft nav · 검색 · 목차
import {
  NAV_PAL_KEY, NAV_COLORS, colorById, pickNextColor,
  isModifiedClick, isSoftNavClickTarget, isSameDocumentUrl, isTopNavTab,
  planSoftClick, syncNavCurrent,
} from './soft-nav-logic.mjs';

(() => {
  const root = document.documentElement;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  const setTheme = (t) => {
    if (t === 'dark') root.dataset.theme = 'dark'; else delete root.dataset.theme;
    document.querySelectorAll('.theme-btn').forEach((b) => b.setAttribute('aria-pressed', String(t === 'dark')));
  };
  setTheme(store.get('theme') === 'dark' ? 'dark' : 'light');
  document.addEventListener('click', (e) => {
    if (e.target.closest('.theme-btn')) { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('theme', t); setTheme(t); }
  });

  const shell = document.querySelector('.l-sidebar');
  if (shell) {
    const narrow = () => matchMedia('(max-width: 1023px)').matches;
    document.addEventListener('click', (e) => {
      if (e.target.closest('.sb-collapse')) { root.classList.add('sb-collapsed'); store.set('sb', '0'); }
      else if (e.target.closest('.sb-open')) { root.classList.remove('sb-collapsed'); store.set('sb', '1'); }
      else if (e.target.closest('.menu-btn')) shell.classList.add('nav-open');
      else if (e.target.closest('.scrim') || (narrow() && e.target.closest('.sidebar a'))) shell.classList.remove('nav-open');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shell.classList.remove('nav-open'); });
  }

  // ----- 내비 팔레트 -----
  const readPal = () => { try { return sessionStorage.getItem(NAV_PAL_KEY); } catch { return null; } };
  const writePal = (id) => { try { sessionStorage.setItem(NAV_PAL_KEY, id); } catch {} };
  const applyPal = (c) => {
    root.style.setProperty('--nav-pal', c.bg);
    root.style.setProperty('--nav-pal-fg', c.fg);
    root.dataset.navPal = c.id;
  };
  let curPal = colorById(readPal() || 'cream');
  applyPal(curPal);
  addEventListener('pageshow', () => { curPal = colorById(readPal() || 'cream'); applyPal(curPal); });

  // ----- 페이지별 위젯 (soft nav 후 다시 붙인다) -----
  let pageAbort = null;
  const initPage = () => {
    if (pageAbort) pageAbort.abort();
    pageAbort = new AbortController();
    const { signal } = pageAbort;

    const archive = document.querySelector('ul.archive');
    if (archive) {
      const tools = document.querySelector('.arch-tools');
      const q = tools?.querySelector('.arch-q');
      const empty = document.querySelector('.arch-empty');
      if (tools && q && empty) {
        const items = [...archive.querySelectorAll('li[data-k]')];
        tools.hidden = false;
        q.addEventListener('input', () => {
          const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
          let hits = 0;
          items.forEach((li) => { const ok = words.every((w) => li.dataset.k.includes(w)); li.hidden = !ok; if (ok) hits++; });
          empty.hidden = hits > 0;
        }, { signal });
      }
    }

    const prose = document.querySelector('.prose');
    const toc = document.querySelector('.ftoc');
    document.body.classList.remove('has-toc');
    if (!prose || !toc) return;
    const hs = [...prose.querySelectorAll('h2[id], h3[id], details.fold')].filter((h) => !h.parentElement.closest('details'));
    if (hs.length < 2) return;
    const rail = toc.querySelector('.ftoc-rail');
    const list = toc.querySelector('.ftoc-list');
    if (!rail || !list) return;
    rail.replaceChildren();
    list.replaceChildren();
    const lines = [], links = [];
    for (const h of hs) {
      const fold = h.tagName === 'DETAILS';
      const lvl = fold ? 'h2' : h.tagName.toLowerCase();
      if (fold && !h.id) h.id = `fold-${lines.length}`;
      const line = document.createElement('span'); line.className = `ftoc-line ${lvl}`; rail.appendChild(line); lines.push(line);
      const a = document.createElement('a'); a.href = `#${h.id}`; a.className = lvl;
      a.textContent = fold ? h.querySelector('summary').textContent : h.textContent;
      list.appendChild(a); links.push(a);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (fold) h.open = true;
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(history.state, '', `#${h.id}`);
        toc.classList.remove('open');
      }, { signal });
    }
    document.body.classList.add('has-toc');
    toc.querySelector('.ftoc-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toc.classList.toggle('open'); }, { signal });
    document.addEventListener('click', (e) => { if (!e.target.closest('.ftoc')) toc.classList.remove('open'); }, { signal });
    let spyCur = -1;
    const spy = () => {
      let i = -1;
      hs.forEach((h, j) => { if (h.offsetParent !== null && h.getBoundingClientRect().top <= 120) i = j; });
      if (i === spyCur) return; spyCur = i;
      lines.forEach((l, j) => l.classList.toggle('on', j === i));
      links.forEach((l, j) => l.classList.toggle('on', j === i));
    };
    addEventListener('scroll', spy, { passive: true, signal });
    addEventListener('resize', spy, { signal });
    spy();
  };
  initPage();

  // ----- soft navigation (탭·태그만; 글 본문 링크는 전체 이동) -----
  let fetchAbort = null;
  let navGen = 0;

  const setTopNavCurrent = (pathname) => {
    const nav = document.querySelector('.topnav .nav');
    if (!nav) return;
    const links = [...nav.querySelectorAll(':scope > a[href]')].map((a) => ({ href: a.href, el: a }));
    const synced = syncNavCurrent(links.map(({ href }) => ({ href })), pathname);
    synced.forEach((s, i) => {
      if (s.current) links[i].el.setAttribute('aria-current', 'page');
      else links[i].el.removeAttribute('aria-current');
    });
  };

  const swapDocument = (html, url, { applyPalAfter = null } = {}) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newMain = doc.querySelector('#main');
    const curMain = document.querySelector('#main');
    if (!newMain || !curMain) throw new Error('missing #main');
    newMain.querySelectorAll('script').forEach((s) => s.remove());
    curMain.replaceWith(document.importNode(newMain, true));

    document.title = doc.title || document.title;
    const abs = new URL(url, location.href);
    setTopNavCurrent(abs.pathname);

    const newCanon = doc.querySelector('link[rel="canonical"]');
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (newCanon) {
      if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
      canon.href = newCanon.href;
    }
    const newDesc = doc.querySelector('meta[name="description"]');
    const desc = document.head.querySelector('meta[name="description"]');
    if (newDesc && desc) desc.setAttribute('content', newDesc.getAttribute('content') || '');

    document.querySelector('.ftoc')?.remove();
    document.body.classList.remove('has-toc');
    const newToc = doc.querySelector('.ftoc');
    if (newToc) {
      newToc.querySelectorAll('script').forEach((s) => s.remove());
      const script = document.querySelector('script[type="module"][src*="site.js"]');
      if (script) script.before(document.importNode(newToc, true));
      else document.body.appendChild(document.importNode(newToc, true));
    }

    // aria-current already updated above; then palette so the outgoing tab never wore the new pill.
    if (applyPalAfter) { applyPal(applyPalAfter); curPal = applyPalAfter; }
    initPage();
    const scrollRoot = document.scrollingElement || document.documentElement;
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
    const main = document.querySelector('#main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      // focus must not reintroduce horizontal offset on narrow viewports
      scrollRoot.scrollLeft = 0;
      document.body.scrollLeft = 0;
    }
  };

  const softNavigate = async (url, { push = true, applyPalAfter = null } = {}) => {
    const gen = ++navGen;
    if (fetchAbort) fetchAbort.abort();
    fetchAbort = new AbortController();
    try {
      const res = await fetch(url, { signal: fetchAbort.signal, headers: { Accept: 'text/html' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (gen !== navGen) return;
      swapDocument(html, url, { applyPalAfter });
      if (push) history.pushState({ soft: 1 }, '', url);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      location.assign(url);
    }
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || !isSoftNavClickTarget(a)) return;
    if (isModifiedClick(e)) return;

    const isTopNav = isTopNavTab(a);
    // Exact URL only — aria-current is section highlight (글 stays current on /posts/tags/…).
    const samePage = isSameDocumentUrl(a.href, location.href);
    const curId = readPal() || curPal.id;
    const plan = planSoftClick({ isTopNav, curId, samePage, modified: false });

    if (plan.action === 'native') return;
    if (plan.action === 'ignore' || plan.action === 'noop') { e.preventDefault(); return; }

    if (plan.action === 'palette-only') {
      e.preventDefault();
      writePal(plan.next.id);
      applyPal(plan.next);
      curPal = plan.next;
      return;
    }

    if (plan.action === 'soft') {
      e.preventDefault();
      let applyAfter = null;
      if (plan.write) {
        writePal(plan.next.id);
        applyAfter = plan.next; // apply only after successful swap (keeps hard-nav flash fix if fetch falls back)
      }
      softNavigate(a.href, { push: true, applyPalAfter: applyAfter });
    }
  });

  addEventListener('popstate', () => {
    softNavigate(location.href, { push: false, applyPalAfter: colorById(readPal() || 'cream') });
  });
})();
