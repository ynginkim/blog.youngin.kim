// 페이지 껍데기. layout: 'sidebar'(왼쪽 사이드바) · 'topnav'(상단 네비게이션) · 'hybrid'(상단 + 넓은 화면에서만 사이드바)
// 본문 영역(.col)은 셋 다 같은 폭·같은 타이포그래피다.
import { esc } from '../kit/kit.mjs';

const svg = (d, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>').replace('<svg', '<svg class="sun"'),
  moon: svg('<path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1z"/>').replace('<svg', '<svg class="moon"'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  panel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
  toc: svg('<path d="M4 6h16M4 12h10M4 18h13"/>'),
};
const themeBtn = () => `<button class="icon-btn theme-btn" type="button" aria-label="다크 모드 전환" title="라이트/다크 전환" aria-pressed="false">${ICON.sun}${ICON.moon}</button>`;

// 첫 페인트 전에 테마·사이드바 상태를 적용해 깜빡임을 막는다. 기본은 라이트.
const BOOT = `<script>(function(){try{var d=document.documentElement;if(localStorage.getItem('theme')==='dark')d.dataset.theme='dark';if(localStorage.getItem('sb')==='0')d.classList.add('sb-collapsed')}catch(e){}})()</script>`;

export function createLayout({ site, layout, nav, series, posts, assetVersion }) {
  const isCur = (href, cur) => (href === '/' ? cur === '/' : cur.startsWith(href));
  const navLinks = (cur) => nav.map(([href, label]) => `<a href="${href}"${isCur(href, cur) ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');

  const topnav = (cur) => `<header class="topnav"><div class="col topnav-in">
  <a class="brand" href="/">${esc(site.author)}</a>
  <nav class="nav" aria-label="주 메뉴">${navLinks(cur)}${themeBtn()}</nav>
</div></header>`;

  const sidebar = (cur) => {
    const cur1 = (href) => (href === cur ? ' aria-current="page"' : '');
    const seriesHtml = series.length ? `<div class="sb-sec"><div class="sb-label">연재</div>${series.map((s) => `
      <a class="sb-series" href="${s.url}"${cur1(s.url)}>${esc(s.title)}</a>
      <ol class="sb-parts">${s.posts.map((p) => `<li><a href="${p.url}"${cur1(p.url)}><span class="n">${String(p.part).padStart(2, '0')}</span>${esc(p.short)}</a></li>`).join('')}</ol>`).join('')}</div>` : '';
    const solo = posts.filter((p) => !p.series).slice(0, 8);
    const postsHtml = solo.length ? `<div class="sb-sec"><div class="sb-label">최근 글</div>${solo.map((p) => `<a href="${p.url}"${cur1(p.url)}>${esc(p.short)}</a>`).join('')}</div>` : '';
    return `<aside class="sidebar" aria-label="사이트 탐색">
  <div class="sb-top"><a class="brand" href="/">${esc(site.author)}</a><button class="icon-btn sb-collapse" type="button" aria-label="사이드바 접기" title="사이드바 접기">${ICON.panel}</button></div>
  <nav class="sb-sec sb-nav" aria-label="주 메뉴">${nav.map(([href, label]) => `<a href="${href}"${isCur(href, cur) ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>
  ${seriesHtml}
  ${postsHtml}
  <div class="sb-foot"><a href="/rss.xml">RSS</a><a href="${esc(site.github)}" rel="me noopener" target="_blank">GitHub</a>${themeBtn()}</div>
</aside>`;
  };

  const footer = () => `<footer class="foot"><span>© ${new Date().getFullYear()} ${esc(site.author)}</span><span class="sp"></span><a href="/rss.xml">RSS</a><a href="${esc(site.github)}" rel="me noopener" target="_blank">GitHub</a></footer>`;

  const tocHtml = `<nav class="ftoc" aria-label="목차"><button class="ftoc-btn" type="button" aria-label="목차 열기">${ICON.toc}</button><div class="ftoc-rail" aria-hidden="true"></div><div class="ftoc-panel"><div class="ftoc-title">목차</div><div class="ftoc-list"></div></div></nav>`;

  return function page({ url, docTitle, head, body, toc = false }) {
    const chrome = {
      sidebar: `<a class="skip" href="#main">본문으로 건너뛰기</a>
${sidebar(url)}
<div class="scrim"></div>
<button class="icon-btn sb-open" type="button" aria-label="사이드바 펼치기" title="사이드바 펼치기">${ICON.panel}</button>
<div class="page">
<div class="mbar"><button class="icon-btn menu-btn" type="button" aria-label="메뉴 열기">${ICON.menu}</button><a class="brand" href="/">${esc(site.author)}</a>${themeBtn()}</div>
<main id="main" class="col">${body}${footer()}</main>
</div>`,
      topnav: `<a class="skip" href="#main">본문으로 건너뛰기</a>
${topnav(url)}
<main id="main" class="col">${body}${footer()}</main>`,
      hybrid: `<a class="skip" href="#main">본문으로 건너뛰기</a>
${topnav(url)}
${sidebar(url)}
<main id="main" class="col">${body}${footer()}</main>`,
    }[layout];
    if (!chrome) throw new Error(`알 수 없는 layout: ${layout} (sidebar | topnav | hybrid)`);
    return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
${BOOT}
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/assets/style.css?v=${assetVersion}">
${head}
</head>
<body class="l-${layout}">
${chrome}
${toc ? tocHtml : ''}
<script src="/assets/site.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
  };
}
