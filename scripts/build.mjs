// posts/*.md + pages/*.md → dist/ (정적 HTML, rss.xml, sitemap.xml)
// 사용: node scripts/build.mjs [--drafts] [--layout=sidebar|topnav|hybrid] [--out=dist] [--noindex]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import { Marked } from 'marked';
import * as k from '../kit/kit.mjs';
import site from '../site.config.mjs';
import { createLayout } from '../theme/layout.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const OUT = path.resolve(ROOT, arg('out') ?? 'dist');
const LAYOUT = arg('layout') ?? process.env.BLOG_LAYOUT ?? site.layout ?? 'topnav';
const withDrafts = process.argv.includes('--drafts');
const noindex = process.argv.includes('--noindex'); // 미리보기 배포용: 검색엔진 색인 막기
const esc = k.esc;

// ---------- 마크다운 ----------
const slugify = (s) => String(s).trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-') || 'section';
// CommonMark 강조 규칙은 '처리량(…)**이라고'처럼 닫는 ** 뒤에 한글이 바로 붙으면 굵게 처리하지 않는다.
// 코드 밖의 **…**를 미리 <strong>으로 바꿔 한국어 문장에서도 굵게가 깨지지 않게 한다.
function cjkStrong(src) {
  return src.split(/(^```[\s\S]*?^```)/m).map((part, i) => (i % 2 ? part : part.split(/(`[^`\n]*`)/).map((t, j) => (j % 2 ? t
    : t.replace(/\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*/g, '<strong>$1</strong>'))).join(''))).join('');
}
function mdToHtml(src) {
  src = cjkStrong(src);
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
        return `<pre><code${kind ? ` class="language-${esc(kind)}"` : ''}>${esc(text)}</code></pre>\n`;
      },
      table(token) { return `<div class="table-wrap">${this.constructor.prototype.table.call(this, token)}</div>`; },
    },
  });
  // <!-- toggle: 제목 --> ... <!-- /toggle --> 는 접히는 블록으로
  const folds = [];
  src = src.replace(/<!--\s*toggle:\s*(.+?)\s*-->([\s\S]*?)<!--\s*\/toggle\s*-->/g, (all, title, inner) => {
    folds.push(`<details class="fold"><summary>${esc(title)}</summary><div class="fold-body">${md.parse(inner)}</div></details>`);
    return `\n\n<!--FOLD_${folds.length - 1}-->\n\n`;
  });
  return md.parse(src).replace(/<!--FOLD_(\d+)-->/g, (all, i) => folds[+i]);
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
const seriesConf = site.series ?? {};
const posts = load('posts').map(({ file, slug, data, content }) => {
  const fail = (m) => { throw new Error(`${file}: ${m}`); };
  if (!data.title) fail('title이 없다');
  const date = ymd(data.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`date는 YYYY-MM-DD (${data.date})`);
  const category = data.category ?? 'note'; if (!site.categories[category]) fail(`category는 ${Object.keys(site.categories).join('|')} 중 하나 (${category})`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(`slug는 영문 소문자·숫자·- (${slug})`);
  const series = data.series ? String(data.series) : null;
  if (series && !seriesConf[series]) fail(`series '${series}'가 site.config.mjs의 series에 없다`);
  if (series && !Number.isInteger(data.part)) fail('series가 있으면 part(1, 2, …)도 적는다');
  const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).map(String);
  return { slug, title: String(data.title), short: data.short ? String(data.short) : String(data.title), date, category, tags, series, part: series ? data.part : null,
    summary: data.summary ? String(data.summary) : '', order: Number(data.order ?? 0), draft: data.draft === true, content,
    url: `/posts/${slug}/`, minutes: Math.max(1, Math.round(content.replace(/<!--\s*toggle:[\s\S]*?<!--\s*\/toggle\s*-->/g, '').replace(/\s/g, '').length / 500)) };
}).filter((p) => withDrafts || !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order || a.slug.localeCompare(b.slug)); // 최신 글 먼저. 같은 날은 order가 큰 글이 나중 글
{ const seen = new Set(); for (const p of posts) { if (seen.has(p.slug)) throw new Error(`slug가 겹친다: ${p.slug}`); seen.add(p.slug); } }

// 연재: site.config.mjs의 series + 글의 series/part
const series = Object.entries(seriesConf).map(([id, s]) => {
  const list = posts.filter((p) => p.series === id).sort((a, b) => a.part - b.part);
  return { id, title: s.title, description: s.description ?? '', url: `/series/${id}/`, posts: list, updated: list.map((p) => p.date).sort().at(-1) };
}).filter((s) => s.posts.length);
const seriesOf = (p) => series.find((s) => s.id === p.series);

const tagSlug = (t) => t.trim().toLowerCase().replace(/\s+/g, '-');
const tagCounts = new Map(); for (const p of posts) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
const allTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
const catName = (c) => site.categories[c].name;
const krDate = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; };

// ---------- 출력 ----------
const css = fs.readFileSync(path.join(ROOT, 'theme/style.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'theme/site.js'), 'utf8');
const assetVersion = crypto.createHash('sha1').update(css + js).digest('hex').slice(0, 8);
const nav = site.nav ?? [['/posts/', '글'], ['/series/', '연재'], ['/about/', '소개']];
const render = createLayout({ site, layout: LAYOUT, nav, series, posts, assetVersion });

const pages = []; // sitemap용
function emit(url, { title, body, description = site.description, type = 'website', fullTitle, sitemap = true, lastmod, toc = false }) {
  const docTitle = fullTitle ?? (url === '/' ? site.title : `${title} · ${site.title}`);
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
<meta name="twitter:card" content="summary">${noindex ? '\n<meta name="robots" content="noindex, nofollow">' : ''}`;
  const file = url.endsWith('.html') ? path.join(OUT, url) : path.join(OUT, url, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, render({ url, docTitle, head, body, toc }));
  if (sitemap) pages.push({ url: abs, lastmod });
}

// 목록 조각
const postItem = (p) => {
  const s = seriesOf(p);
  return `<li><a href="${p.url}"><span class="t">${esc(p.title)}</span>${p.summary ? `<span class="s">${esc(p.summary)}</span>` : ''}<span class="m">${krDate(p.date)}${s ? ` · <span class="ser">${esc(s.title)} ${p.part}편</span>` : ''}${p.draft ? ' · 초안' : ''}</span></a></li>`;
};
const postList = (list) => (list.length ? `<ul class="plist">${list.map(postItem).join('')}</ul>` : '<p class="page-desc">아직 글이 없습니다.</p>');
const seriesItem = (s, { parts = true } = {}) => `<li><a href="${s.url}"><span class="k">연재 · ${s.posts.length}편</span><span class="t">${esc(s.title)}</span>${s.description ? `<span class="s">${esc(s.description)}</span>` : ''}</a>${parts ? `<ol>${s.posts.map((p) => `<li><a href="${p.url}">${esc(p.title)}</a></li>`).join('')}</ol>` : ''}</li>`;
const sec = (title, more, inner) => `<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${more ? `<a href="${more[0]}">${esc(more[1])}</a>` : ''}</div>${inner}</section>`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets/style.css'), css);
fs.writeFileSync(path.join(OUT, 'assets/site.js'), js);

// 홈
emit('/', {
  title: site.title, lastmod: posts[0]?.date,
  body: `<div class="intro"><h1>${esc(site.title)}</h1><p>${esc(site.description)}</p></div>
${series.length ? sec('연재', ['/series/', '모든 연재'], `<ul class="slist">${series.map((s) => seriesItem(s)).join('')}</ul>`) : ''}
${sec('글', posts.length > 10 ? ['/posts/', '모든 글'] : null, postList(posts.slice(0, 10)))}`,
});

// 글 목록(연도별)
{
  const years = [...new Set(posts.map((p) => p.date.slice(0, 4)))];
  emit('/posts/', { title: '글', lastmod: posts[0]?.date, description: `${site.title}의 모든 글`,
    body: `<h1 class="page-title">글</h1><p class="page-desc">모두 ${posts.length}편</p>${years.map((y) => `<h2 class="year">${y}</h2>${postList(posts.filter((p) => p.date.startsWith(y)))}`).join('')}` });
}

// 연재
emit('/series/', { title: '연재', lastmod: series[0]?.updated, description: `${site.title}의 연재`,
  body: `<h1 class="page-title">연재</h1><p class="page-desc">여러 편으로 이어지는 글</p><ul class="slist">${series.map((s) => seriesItem(s)).join('')}</ul>` });
for (const s of series) {
  emit(s.url, { title: s.title, lastmod: s.updated, description: s.description || `${s.title} 연재`,
    body: `<a class="kicker" href="/series/">연재<span class="dot"></span>${s.posts.length}편</a><h1 class="page-title">${esc(s.title)}</h1>${s.description ? `<p class="page-desc">${esc(s.description)}</p>` : ''}${postList(s.posts).replace(/<span class="m">([^<]*) · <span class="ser">[^<]*<\/span>/g, (m, d) => `<span class="m">${d}`)}` });
}

// 글
posts.forEach((p, i) => {
  const s = seriesOf(p);
  let prev, next, prevLabel = '이전 글', nextLabel = '다음 글';
  if (s) {
    const j = s.posts.indexOf(p); prev = s.posts[j - 1]; next = s.posts[j + 1]; prevLabel = '이전 편'; nextLabel = '다음 편';
  } else { prev = posts[i + 1]; next = posts[i - 1]; }
  const seriesBox = s ? `<nav class="series" aria-label="연재 목차"><div class="series-h"><a href="${s.url}">${esc(s.title)}</a><small>${p.part} / ${s.posts.length}편</small></div><ol>${s.posts.map((q) => `<li>${q === p ? `<span aria-current="page">${esc(q.title)}</span>` : `<a href="${q.url}">${esc(q.title)}</a>`}</li>`).join('')}</ol></nav>` : '';
  const pnav = prev || next ? `<nav class="pnav" aria-label="${prevLabel}·${nextLabel}">${prev ? `<a class="prev" href="${prev.url}"><small>← ${prevLabel}</small><span>${esc(prev.title)}</span></a>` : ''}${next ? `<a class="next" href="${next.url}"><small>${nextLabel} →</small><span>${esc(next.title)}</span></a>` : ''}</nav>` : '';
  emit(p.url, {
    title: p.title, type: 'article', description: p.summary || site.description, lastmod: p.date, toc: true,
    body: `<article>
<header class="post-head">
${s ? `<a class="kicker" href="${s.url}">${esc(s.title)}<span class="dot"></span>${p.part}편</a>` : `<a class="kicker" href="/category/${p.category}/">${esc(catName(p.category))}</a>`}
<h1 class="post-title">${esc(p.title)}</h1>
<div class="post-meta"><time datetime="${p.date}">${krDate(p.date)}</time><span>약 ${p.minutes}분</span>${p.draft ? '<span>초안</span>' : ''}</div>
</header>
${seriesBox}
<div class="prose">
${mdToHtml(p.content)}
</div>
<footer class="post-foot">
${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<a href="/tags/${encodeURIComponent(tagSlug(t))}/">#${esc(t)}</a>`).join('')}</div>` : ''}
${pnav}
</footer>
</article>`,
  });
});

// 분류·태그(기존 주소 유지)
for (const c of Object.keys(site.categories)) {
  const list = posts.filter((p) => p.category === c); if (!list.length) continue;
  emit(`/category/${c}/`, { title: catName(c), description: `${catName(c)} 글 목록`, lastmod: list[0].date,
    body: `<a class="kicker" href="/posts/">분류</a><h1 class="page-title">${esc(catName(c))}</h1><p class="page-desc">${list.length}편</p>${postList(list)}` });
}
for (const t of allTags) {
  const list = posts.filter((p) => p.tags.includes(t));
  emit(`/tags/${tagSlug(t)}/`, { title: `#${t}`, description: `#${t} 태그가 붙은 글`, lastmod: list[0].date,
    body: `<a class="kicker" href="/posts/">태그</a><h1 class="page-title">#${esc(t)}</h1><p class="page-desc">${list.length}편</p>${postList(list)}` });
}

// 고정 페이지(pages/*.md → /<slug>/)
for (const pg of load('pages')) {
  const title = String(pg.data.title ?? pg.slug);
  emit(`/${pg.slug}/`, { title, description: pg.data.description ? String(pg.data.description) : site.description,
    body: `<h1 class="page-title">${esc(title)}</h1><div class="prose">${mdToHtml(pg.content)}</div>` });
}

// 404
emit('/404.html', { title: '페이지를 찾을 수 없습니다', fullTitle: `페이지를 찾을 수 없습니다 · ${site.title}`, sitemap: false,
  body: `<h1 class="page-title">페이지를 찾을 수 없습니다</h1><p class="page-desc">주소가 바뀌었거나 없는 페이지입니다. <a href="/">홈으로 가기</a></p>` });

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
fs.writeFileSync(path.join(OUT, 'robots.txt'), noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

console.log(`빌드 완료(layout=${LAYOUT}): 글 ${posts.length}편${withDrafts ? '(초안 포함)' : ''}, 연재 ${series.length}개, 페이지 ${pages.length + 1}개 → ${path.relative(ROOT, OUT) || '.'}/`);
