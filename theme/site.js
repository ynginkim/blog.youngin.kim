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

  // 글 탭: 주소의 #분류로 들어오면 그 분류를 연다 · 검색 · 모두 펼치기/접기
  const archive = document.querySelector('.archive');
  if (archive) {
    const groups = [...archive.querySelectorAll('details.arch')];
    const openHash = () => { const d = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (d && d.matches('details.arch')) { d.open = true; d.scrollIntoView({ block: 'start' }); } };
    openHash(); addEventListener('hashchange', openHash);
    const tools = document.querySelector('.arch-tools');
    const q = tools.querySelector('.arch-q');
    const all = tools.querySelector('.arch-all');
    const empty = document.querySelector('.arch-empty');
    tools.hidden = false;
    let saved = null; // 검색 전 열림 상태
    const sync = () => { const open = groups.every((d) => d.open); all.textContent = open ? '모두 접기' : '모두 펼치기'; all.setAttribute('aria-pressed', String(open)); };
    groups.forEach((d) => d.addEventListener('toggle', sync));
    all.addEventListener('click', () => { const open = !groups.every((d) => d.open); groups.forEach((d) => { d.open = open; }); sync(); });
    q.addEventListener('input', () => {
      const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length && !saved) saved = groups.map((d) => d.open);
      let hits = 0;
      groups.forEach((d, i) => {
        let n = 0;
        d.querySelectorAll('li[data-k]').forEach((li) => { const ok = words.every((w) => li.dataset.k.includes(w)); li.hidden = !ok; if (ok) n++; });
        d.hidden = words.length > 0 && n === 0;
        if (words.length) d.open = n > 0; else if (saved) d.open = saved[i];
        hits += n;
      });
      if (!words.length) saved = null;
      empty.hidden = !(words.length && hits === 0);
      sync();
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
