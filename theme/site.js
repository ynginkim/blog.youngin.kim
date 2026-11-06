// 테마 토글 · 사이드바 접기 · 목차(오른쪽 대시 레일)
(() => {
  const root = document.documentElement;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  // 테마: 기본은 라이트. 고른 값만 기억한다(시스템 설정은 따르지 않음).
  const setTheme = (t) => {
    if (t === 'dark') root.dataset.theme = 'dark'; else delete root.dataset.theme;
    document.querySelectorAll('.theme-btn').forEach((b) => b.setAttribute('aria-pressed', String(t === 'dark')));
  };
  setTheme(store.get('theme') === 'dark' ? 'dark' : 'light');
  document.addEventListener('click', (e) => {
    if (e.target.closest('.theme-btn')) { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('theme', t); setTheme(t); }
  });

  // 사이드바: 넓은 화면에서는 접기/펴기(기억), 좁은 화면에서는 서랍
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

  // 글 탭 검색: 지금 보이는 목록(전체 또는 태그) 안에서 제목·태그로 거른다
  const archive = document.querySelector('ul.archive');
  if (archive) {
    const tools = document.querySelector('.arch-tools');
    const q = tools.querySelector('.arch-q');
    const empty = document.querySelector('.arch-empty');
    const items = [...archive.querySelectorAll('li[data-k]')];
    tools.hidden = false;
    q.addEventListener('input', () => {
      const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let hits = 0;
      items.forEach((li) => { const ok = words.every((w) => li.dataset.k.includes(w)); li.hidden = !ok; if (ok) hits++; });
      empty.hidden = hits > 0;
    });
  }


  // B 시안: 상단 내비(글/소개) 클릭 시 활성 필 색을 5색 중 다른 색으로. sessionStorage로 페이지 이동 후에도 유지.
  if (document.documentElement.dataset.palette === 'b') {
    const root = document.documentElement;
    const KEY = 'navPal';
    const COLORS = [
      { id: 'cream', bg: '#E3CDB1', fg: '#0E1013' },
      { id: 'olive', bg: '#7C5C3E', fg: '#FFFFFF' },
      { id: 'muted', bg: '#726A4D', fg: '#FFFFFF' },
      { id: 'terra', bg: '#AA5C3C', fg: '#FFFFFF' },
      { id: 'teal', bg: '#294F4F', fg: '#FFFFFF' },
    ];
    const byId = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
    const read = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
    const write = (id) => { try { sessionStorage.setItem(KEY, id); } catch {} };
    const apply = (c) => {
      root.style.setProperty('--nav-pal', c.bg);
      root.style.setProperty('--nav-pal-fg', c.fg);
      root.dataset.navPal = c.id;
    };
    let cur = byId(read() || 'cream');
    apply(cur);
    document.querySelectorAll('.topnav .nav > a[href]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const others = COLORS.filter((c) => c.id !== cur.id);
        const next = others[Math.floor(Math.random() * others.length)] || COLORS[0];
        write(next.id);
        apply(next);
        cur = next;
      });
    });
  }

  // 목차
  const prose = document.querySelector('.prose');
  const toc = document.querySelector('.ftoc');
  if (!prose || !toc) return;
  // 접힌 블록(부록 등) 안의 제목은 빼고, 접힌 블록 자체를 한 항목으로 넣는다
  const hs = [...prose.querySelectorAll('h2[id], h3[id], details.fold')].filter((h) => !h.parentElement.closest('details'));
  if (hs.length < 2) return;
  const rail = toc.querySelector('.ftoc-rail');
  const list = toc.querySelector('.ftoc-list');
  const lines = [], links = [];
  for (const h of hs) {
    const fold = h.tagName === 'DETAILS';
    const lvl = fold ? 'h2' : h.tagName.toLowerCase();
    if (fold && !h.id) h.id = `fold-${lines.length}`;
    const line = document.createElement('span'); line.className = `ftoc-line ${lvl}`; rail.appendChild(line); lines.push(line);
    const a = document.createElement('a'); a.href = `#${h.id}`; a.className = lvl; a.textContent = fold ? h.querySelector('summary').textContent : h.textContent; list.appendChild(a); links.push(a);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (fold) h.open = true;
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${h.id}`);
      toc.classList.remove('open');
    });
  }
  document.body.classList.add('has-toc');
  toc.querySelector('.ftoc-btn').addEventListener('click', (e) => { e.stopPropagation(); toc.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.ftoc')) toc.classList.remove('open'); });

  let cur = -1;
  const spy = () => {
    let i = -1;
    hs.forEach((h, j) => { if (h.offsetParent !== null && h.getBoundingClientRect().top <= 120) i = j; });
    if (i === cur) return; cur = i;
    lines.forEach((l, j) => l.classList.toggle('on', j === i));
    links.forEach((l, j) => l.classList.toggle('on', j === i));
  };
  addEventListener('scroll', spy, { passive: true }); addEventListener('resize', spy); spy();
})();
