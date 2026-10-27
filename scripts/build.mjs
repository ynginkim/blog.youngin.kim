// posts/*.md + pages/*.md → dist/ (정적 HTML, rss.xml, sitemap.xml)
// 사용: node scripts/build.mjs [--drafts]
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { Marked } from 'marked';
import * as k from '../kit/kit.mjs';
import site from '../site.config.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'dist');
const withDrafts = process.argv.includes('--drafts');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'kit/template.html'), 'utf8');
const esc = k.esc;

// ---------- 마크다운 ----------
const slugify = (s) => String(s).trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-') || 'section';
function mdToHtml(src) {
  const used = new Map();
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const base = slugify(text); const n = used.get(base) ?? 0; used.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        return `<h${depth} id="${esc(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      code({ text, lang = '' }) {
        const [kind, ...rest] = lang.trim().split(/\s+/);
        if (kind === 'mermaid') { const caption = rest.join(' '); return k.mermaid(text, { label: caption, caption }); }
        return `<div class="table-wrap"><pre><code${kind ? ` class="language-${esc(kind)}"` : ''}>${esc(text)}</code></pre></div>\n`;
      },
      table(token) { return `<div class="table-wrap">${this.constructor.prototype.table.call(this, token)}</div>`; },
    },
  });
  // <!-- toggle: 제목 --> ... <!-- /toggle --> 는 접히는 블록으로
  const toggles = [];
  src = src.replace(/<!--\s*toggle:\s*(.+?)\s*-->([\s\S]*?)<!--\s*\/toggle\s*-->/g, (all, title, inner) => {
    toggles.push(k.toggles(k.toggle({ title, body: `<div class="md">${md.parse(inner)}</div>` })));
    return `\n\n<!--TOGGLE_${toggles.length - 1}-->\n\n`;
  });
  let html = `<div class="md">${md.parse(src)}</div>`;
  html = html.replace(/<!--TOGGLE_(\d+)-->/g, (all, i) => `</div>${toggles[+i]}<div class="md">`).replace(/<div class="md">\s*<\/div>/g, '');
  return html;
}

// ---------- 글 읽기 ----------
const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '').trim());
function load(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.md')).map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(abs, f), 'utf8'));
    return { file: `${dir}/${f}`, slug: data.slug || f.replace(/\.md$/, ''), data, content };
  });
}
const posts = load('posts').map(({ file, slug, data, content }) => {
  const fail = (m) => { throw new Error(`${file}: ${m}`); };
  if (!data.title) fail('title이 없다');
  const date = ymd(data.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`date는 YYYY-MM-DD (${data.date})`);
  const category = data.category ?? 'note'; if (!site.categories[category]) fail(`category는 ${Object.keys(site.categories).join('|')} 중 하나 (${category})`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(`slug는 영문 소문자·숫자·- (${slug})`);
  const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).map(String);
  return { slug, title: String(data.title), short: data.short ? String(data.short) : String(data.title), date, category, tags,
    summary: data.summary ? String(data.summary) : '', order: Number(data.order ?? 0), draft: data.draft === true, featured: data.featured === true, content,
    url: `/posts/${slug}/`, minutes: Math.max(1, Math.round(content.replace(/<!--\s*toggle:[\s\S]*?<!--\s*\/toggle\s*-->/g, '').replace(/\s/g, '').length / 500)) };
}).filter((p) => withDrafts || !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order || a.slug.localeCompare(b.slug)); // 최신 글 먼저. 같은 날은 order가 큰 글이 나중 글
{ const seen = new Set(); for (const p of posts) { if (seen.has(p.slug)) throw new Error(`slug가 겹친다: ${p.slug}`); seen.add(p.slug); } }
// 분류 안 번호(오래된 글부터 01, 02 …)
for (const c of Object.keys(site.categories)) posts.filter((p) => p.category === c).reverse().forEach((p, i) => { p.no = String(i + 1).padStart(2, '0'); });

const tagSlug = (t) => t.trim().toLowerCase().replace(/\s+/g, '-');
const tagCounts = new Map(); for (const p of posts) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
const allTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
const tagColor = (t) => k.cat((allTags.indexOf(t) % 8) + 1).color;
const catName = (c) => site.categories[c].name;
const catColor = (c) => k.cat(site.categories[c].color).color;
const tagLink = (t) => `<a class="tag" href="/tags/${encodeURIComponent(tagSlug(t))}/"><span class="dot" style="background:${tagColor(t)}"></span>${esc(t)}</a>`;
const catLink = (c) => `<a class="tag" href="/category/${c}/"><span class="dot" style="background:${catColor(c)}"></span>${esc(catName(c))}</a>`;
const link = (href, text) => `<a class="page-link" href="${esc(href)}">${esc(text)}</a>`;

// ---------- 사이드바 ----------
const ic = (paths, s = 16) => `<svg class="lu" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const I = {
  home: ic('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  user: ic('<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
  rss: ic('<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>', 14),
  link: ic('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', 14),
  chev: ic('<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>', 16),
};
const year = new Date().getFullYear();
function sidebar(cur) {
  const item = (href, inner, cls = '') => `<a class="sb-item ${cls}" href="${esc(href)}"${href === cur ? ' aria-current="page"' : ''}>${inner}</a>`;
  const groups = Object.keys(site.categories).map((c) => {
    const list = posts.filter((p) => p.category === c); if (!list.length) return '';
    const shown = list.slice(0, site.sidebarPostsPerCategory);
    return `<div class="sb-group"><div class="sb-label"><a href="/category/${c}/">${esc(catName(c))}</a><span class="cnt">${list.length}</span></div>
    ${shown.map((p) => item(p.url, `<span class="t">${esc(p.short)}</span><span class="d">${p.date.slice(5).replace('-', '.')}</span>`, 'post')).join('')}
    ${list.length > shown.length ? `<a class="sb-more" href="/category/${c}/">모두 보기 →</a>` : ''}</div>`;
  }).join('');
  const tags = allTags.length ? `<div class="sb-group"><div class="sb-label"><span>태그</span></div><div class="sb-tags">${allTags.map((t) => `<a class="sb-tag" href="/tags/${encodeURIComponent(tagSlug(t))}/">#${esc(t)}</a>`).join('')}</div></div>` : '';
  return `
  <div class="sb-id">
    <a class="sb-brand" href="/"><span class="mono">김</span><span class="bt"><b>${esc(site.author)}</b><small>${esc(site.url.replace(/^https?:\/\//, ''))}</small></span></a>
    <button class="icon-btn sb-close" type="button" aria-label="사이드바 닫기" title="사이드바 닫기">${I.chev}</button>
  </div>
  <nav class="sb-main">${item('/', `${I.home}<span>홈</span>`)}${item('/about/', `${I.user}<span>소개</span>`)}</nav>
  ${groups}${tags}
  <nav class="sb-nav" hidden></nav>
  <div class="sb-foot2"><a href="/rss.xml">${I.rss}RSS</a><a href="${esc(site.github)}" rel="me noopener" target="_blank">${I.link}GitHub</a><span class="cp">© ${year} ${esc(site.author)}</span></div>`;
}

// ---------- 페이지 조립 ----------
const pages = []; // sitemap용
function emit(url, { title, crumb = '', eyebrow, props = [], body, description = site.description, type = 'website', fullTitle, sitemap = true, lastmod }) {
  const id = url === '/' ? 'home' : url.replace(/^\/|\/$/g, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'page';
  const docTitle = fullTitle ?? (url === '/' ? site.title : `${title} · ${site.title}`);
  const article = `<article class="doc" data-page="${esc(id)}" data-title="${esc(title)}" data-icon="${esc(crumb)}" data-nav="${esc(title)}">
<header class="ph ph-type"><div class="ph-grid" aria-hidden="true"></div><div class="ph-in"><div class="ph-eyebrow">${eyebrow}</div></div></header>
<div class="page">
<h1 class="title">${esc(title)}</h1>
${props.length ? `<div class="props">${props.map((q) => `<div class="prop"><span class="prop-name"><span class="pi">${esc(q.icon)}</span>${esc(q.name)}</span><span>${q.html}</span></div>`).join('')}</div>` : ''}
${body}
</div>
</article>`;
  const abs = site.url + url;
  const head = `<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(abs)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/rss.xml">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(abs)}">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">`;
  const html = TEMPLATE
    .replace('<!-- title -->', () => esc(docTitle))
    .replace('<!-- head -->', () => head)
    .replace('<!-- sidebar -->', () => sidebar(url))
    .replace('<!-- tbbrand -->', () => `<a class="tb-brand" href="/"><span class="mono">김</span>${esc(site.author)}</a>`)
    .replace(/<!-- pages:start -->[\s\S]*?<!-- pages:end -->/, () => `<!-- pages:start -->\n${article}\n<!-- pages:end -->`);
  const file = url.endsWith('.html') ? path.join(OUT, url) : path.join(OUT, url, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  if (sitemap) pages.push({ url: abs, lastmod });
}

const eyebrow = (...parts) => parts.map((p, i) => (i ? '<span class="sep"></span>' : '') + p).join('');
const postTable = (list) => list.length ? k.notionTable(
  [{ label: '제목', icon: 'Aa' }, { label: '분류', icon: '≡' }, { label: '태그', icon: '#' }, { label: '작성일', icon: '◷' }],
  list.map((p) => [link(p.url, p.title) + (p.draft ? ' <small class="empty">(초안)</small>' : ''), catLink(p.category), p.tags.map(tagLink).join(' '), p.date]),
) : '<p class="empty">아직 글이 없습니다.</p>';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });

// 홈
const featured = posts.filter((p) => p.featured);
emit('/', {
  title: site.title, eyebrow: `<span>${esc(site.url.replace(/^https?:\/\//, ''))}</span>`, lastmod: posts[0]?.date,
  body: `${k.h2('최근 글')}
${postTable(posts)}
${featured.length ? `${k.h2('대표 글')}\n${k.grid2(...featured.map((p) => k.card({ title: p.title, desc: `${catName(p.category)} · ${p.date} · 약 ${p.minutes}분`, body: `${p.summary ? `<p>${esc(p.summary)}</p>` : ''}<p>${link(p.url, '읽기 →')}</p>` })))}` : ''}
${k.callout({ emoji: '📮', quiet: true, body: `<p>새 글은 <a class="page-link" href="/rss.xml">RSS</a>로 받아 볼 수 있습니다.</p>` })}`,
});

// 글
posts.forEach((p, i) => {
  const newer = posts[i - 1], older = posts[i + 1];
  const nav = newer || older ? `<nav class="post-nav" aria-label="이전·다음 글">${older ? `<a class="prev" href="${older.url}"><small>← 이전 글</small>${esc(older.title)}</a>` : ''}${newer ? `<a class="next" href="${newer.url}"><small>다음 글 →</small>${esc(newer.title)}</a>` : ''}</nav>` : '';
  emit(p.url, {
    title: p.title, crumb: `${catName(p.category)} /`, type: 'article', description: p.summary || site.description, lastmod: p.date,
    eyebrow: eyebrow(`<span>${esc(catName(p.category))}</span>`, `<span class="num">No.${p.no}</span>`),
    props: [
      { icon: '◷', name: '작성일', html: esc(p.date) },
      { icon: '≡', name: '분류', html: catLink(p.category) },
      ...(p.tags.length ? [{ icon: '#', name: '태그', html: p.tags.map(tagLink).join(' ') }] : []),
      { icon: '⏱', name: '읽는 시간', html: `약 ${p.minutes}분` },
    ],
    body: `${p.summary ? k.callout({ emoji: '📌', title: '한 줄 요약', body: `<p>${esc(p.summary)}</p>` }) : ''}
${mdToHtml(p.content)}
${nav}`,
  });
});

// 분류·태그
for (const c of Object.keys(site.categories)) {
  const list = posts.filter((p) => p.category === c); if (!list.length) continue;
  emit(`/category/${c}/`, { title: catName(c), crumb: '분류 /', eyebrow: `<span>분류</span>`, body: postTable(list), description: `${catName(c)} 글 목록`, lastmod: list[0].date });
}
for (const t of allTags) {
  const list = posts.filter((p) => p.tags.includes(t));
  emit(`/tags/${tagSlug(t)}/`, { title: `#${t}`, crumb: '태그 /', eyebrow: `<span>태그</span>`, body: postTable(list), description: `#${t} 태그가 붙은 글`, lastmod: list[0].date });
}

// 고정 페이지(pages/*.md → /<slug>/)
for (const pg of load('pages')) {
  emit(`/${pg.slug}/`, { title: String(pg.data.title ?? pg.slug), eyebrow: `<span>${esc(String(pg.data.title ?? pg.slug))}</span>`, body: mdToHtml(pg.content), description: pg.data.description ? String(pg.data.description) : site.description });
}

// 404
emit('/404.html', { title: '페이지를 찾을 수 없습니다', fullTitle: `페이지를 찾을 수 없습니다 · ${site.title}`, eyebrow: '<span>404</span>', sitemap: false,
  body: `<p>주소가 바뀌었거나 없는 페이지입니다. ${link('/', '홈으로 가기')}</p>` });

// RSS
const rfc822 = (d) => new Date(`${d}T00:00:00+09:00`).toUTCString();
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
fs.writeFileSync(path.join(OUT, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${x(site.title)}</title>
<link>${site.url}/</link>
<description>${x(site.description)}</description>
<language>${site.lang}</language>
<atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>
${posts[0] ? `<lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>` : ''}
${posts.filter((p) => !p.draft).map((p) => `<item>
<title>${x(p.title)}</title>
<link>${site.url}${p.url}</link>
<guid isPermaLink="true">${site.url}${p.url}</guid>
<pubDate>${rfc822(p.date)}</pubDate>
<category>${x(catName(p.category))}</category>
<description>${x(p.summary)}</description>
</item>`).join('\n')}
</channel>
</rss>
`);

// sitemap·robots
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${x(p.url)}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

console.log(`빌드 완료: 글 ${posts.length}편${withDrafts ? '(초안 포함)' : ''}, 페이지 ${pages.length + 1}개 → dist/`);
