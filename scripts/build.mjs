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
// linkPage: 소개처럼 링크를 모은 페이지. 모든 링크를 파란 링크(.link)로 보이고,
// 링크 title은 브라우저 기본 말풍선 대신 작은 설명 팁(.tip)으로 바꾼다(호버·키보드 포커스 때 보임).
function mdToHtml(src, { linkPage = false } = {}) {
  src = cjkStrong(src);
  const used = new Map();
  let tips = 0;
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      // 본문에서 다른 글로 가는 링크는 홈 꼭지 링크와 같은 파란 링크(.link)로 보인다.
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        if (linkPage) {
          if (!title) return `<a class="link" href="${esc(href)}">${text}</a>`;
          const id = `tip-${++tips}`;
          return `<span class="tipwrap"><a class="link" href="${esc(href)}" aria-describedby="${id}">${text}</a><span class="tip" role="tooltip" id="${id}">${esc(title)}</span></span>`;
        }
        const internal = /^\/posts\/(?!tags\/)/.test(href);
        return `<a${internal ? ' class="link"' : ''} href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}>${text}</a>`;
      },
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
  // <!-- ai-answer: 제목 --> ... <!-- /ai-answer --> 는 AI와 함께 정리한 내용을 담는 회색 접힘 상자로(본문과 구분)
  const folds = [];
  src = src.replace(/<!--\s*(toggle|ai-answer):\s*(.+?)\s*-->([\s\S]*?)<!--\s*\/\1\s*-->/g, (all, kind, title, inner) => {
    const ai = kind === 'ai-answer';
    folds.push(`<details class="fold${ai ? ' ai-answer' : ''}"><summary>${esc(title)}</summary><div class="fold-body">${md.parse(inner)}</div></details>`);
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
  return { id, title: s.title, description: s.description ?? '', url: null, posts: list, updated: list.map((p) => p.date).sort().at(-1) };
}).filter((s) => s.posts.length);
const seriesOf = (p) => series.find((s) => s.id === p.series);

const tagSlug = (t) => t.trim().toLowerCase().replace(/\s+/g, '-');
const tagUrl = (t) => `/posts/tags/${encodeURIComponent(tagSlug(t))}/`;
const tagCounts = new Map(); for (const p of posts) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
const allTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
const catName = (c) => site.categories[c].name;
const krDate = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; };

// ---------- 출력 ----------
// 상단 워드마크 글꼴. 다른 글꼴을 쓰려면 theme/fonts/에 부분 글꼴을 넣고 여기에 한 줄 더한다.
const WORDMARKS = {
  dancing: { family: 'Dancing Script', weight: 700, size: '23px', ls: '0' },
};
const wmKey = site.wordmark.font, wm = WORDMARKS[wmKey];
if (!wm) throw new Error(`wordmark.font '${wmKey}'는 없다: ${Object.keys(WORDMARKS).join(', ')}`);
const wmFont = fs.readFileSync(path.join(ROOT, `theme/fonts/wordmark-${wmKey}.woff2`));
const wmFile = `/assets/fonts/wordmark-${wmKey}.${crypto.createHash('sha1').update(wmFont).digest('hex').slice(0, 8)}.woff2`;
const css = fs.readFileSync(path.join(ROOT, 'theme/style.css'), 'utf8') + `
@font-face { font-family: "${wm.family} Wordmark"; src: url("${wmFile}") format("woff2"); font-weight: ${wm.weight}; font-display: swap; }
.wm { font-family: "${wm.family} Wordmark", ui-rounded, system-ui, sans-serif; font-weight: ${wm.weight}; font-size: ${wm.size}; letter-spacing: ${wm.ls}; }
`;
const js = fs.readFileSync(path.join(ROOT, 'theme/site.js'), 'utf8');
const softNavLogic = fs.readFileSync(path.join(ROOT, 'theme/soft-nav-logic.mjs'), 'utf8');
const assetVersion = crypto.createHash('sha1').update(css + js + softNavLogic).digest('hex').slice(0, 8);
const nav = site.nav ?? [['/posts/', '글'], ['/about/', '소개']];
const render = createLayout({ site, layout: LAYOUT, nav, series, posts, assetVersion, wmFile });

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

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets/style.css'), css);
fs.mkdirSync(path.join(OUT, 'assets/fonts'), { recursive: true });
fs.writeFileSync(path.join(OUT, wmFile), wmFont);
fs.writeFileSync(path.join(OUT, 'assets/site.js'), js);
fs.writeFileSync(path.join(OUT, 'assets/soft-nav-logic.mjs'), softNavLogic);

// 목록 한 줄: 제목 + 작성일만
const dotDate = (d) => d.replaceAll('-', '.');
const row = (p, k = false) => `<li${k ? ` data-k="${esc([p.title, ...p.tags].join(' ').toLowerCase())}"` : ''}><a href="${p.url}"><span class="t">${esc(p.title)}</span><time datetime="${p.date}">${dotDate(p.date)}${p.draft ? ' · 초안' : ''}</time></a></li>`;

// 홈: 나를 보여 주는 진입로. 소개 한 줄 + 세 꼭지 링크(site.homeLinks, 글 탭의 태그 목록으로) + 최근 글(월간 회고 제외).
{
  for (const [, t] of site.homeLinks) if (!tagCounts.has(t)) throw new Error(`site.homeLinks의 태그 '${t}'를 단 글이 없다`);
  const recent = posts.filter((p) => p.series !== 'monthly-retro').slice(0, 5);
  emit('/', {
    title: site.title, lastmod: posts[0]?.date,
    body: `<header class="home-head"><h1 class="home-name">${esc(site.author)}</h1><p class="intro">${esc(site.description)}</p></header>
<nav class="home-links" aria-label="꼭지"><ul>${site.homeLinks.map(([label, t]) => `<li><a class="link" href="${tagUrl(t)}">${esc(label)}</a></li>`).join('')}</ul></nav>
<section class="hgroup" aria-labelledby="h-recent"><h2 id="h-recent">최근 글</h2><ul class="hlist">${recent.map((p) => row(p)).join('')}</ul></section>`,
  });
}

// 옛 주소를 새 주소로 넘기는 작은 페이지(검색엔진에는 올리지 않음)
const redirect = (from, to, label) => emit(from, { title: label, sitemap: false,
  body: `<meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><p class="page-desc"><a href="${to}">${esc(label)} 글 목록으로 이동</a></p>` });

// 글 탭: 전체 글을 시간순(최신 먼저) 한 목록으로. 태그를 고르면 같은 틀에서 그 태그 글만 보여 준다.
// 태그마다 정적 페이지(/posts/tags/<태그>/)를 만들어 JS 없이도 동작한다. 검색은 JS가 있을 때만 보이며 지금 목록 안에서 거른다.
{
  const tagLink = (t, active) => `<a href="${tagUrl(t)}"${t === active ? ' aria-current="page"' : ''}>${esc(t)}<span class="n">${tagCounts.get(t)}</span></a>`;
  const archive = (active) => {
    const list = active ? posts.filter((p) => p.tags.includes(active)) : posts;
    return `<h1 class="page-title">글</h1><p class="page-desc">${active ? `#${esc(active)} · ${list.length}편` : `모두 ${list.length}편`}</p>
<div class="arch-tools" hidden><input class="arch-q" type="search" placeholder="제목·태그로 찾기" aria-label="글 찾기" autocomplete="off"></div>
<nav class="tagbar" aria-label="태그"><div class="tag-row"><a href="/posts/"${active ? '' : ' aria-current="page"'}>전체<span class="n">${posts.length}</span></a>${allTags.map((t) => tagLink(t, active)).join('')}</div></nav>
<p class="arch-empty" role="status" hidden>찾는 글이 없습니다.</p>
<ul class="hlist archive">${list.map((p) => row(p, true)).join('')}</ul>`;
  };
  emit('/posts/', { title: '글', lastmod: posts[0]?.date, description: `${site.title}의 모든 글`, body: archive(null) });
  for (const t of allTags) {
    const list = posts.filter((p) => p.tags.includes(t));
    emit(`/posts/tags/${tagSlug(t)}/`, { title: `#${t}`, description: `#${t} 태그가 붙은 글`, lastmod: list[0].date, body: archive(t) });
    redirect(`/tags/${tagSlug(t)}/`, tagUrl(t), `#${t}`);

  }
}

// 예전 태그·분류 주소
for (const [old, now] of Object.entries(site.tagRedirects ?? {})) {
  if (tagCounts.has(old)) continue;
  const to = now && tagCounts.has(now) ? tagUrl(now) : '/posts/', label = now && tagCounts.has(now) ? `#${now}` : '전체';
  redirect(`/tags/${tagSlug(old)}/`, to, label);
  redirect(`/posts/tags/${tagSlug(old)}/`, to, label);
}
for (const c of Object.keys(site.categories)) redirect(`/category/${c}/`, '/posts/', '전체');

// 연재 전용 페이지는 두지 않는다. 연재는 글 제목 옆 라벨과 글 안의 연재 상자로만 보인다.

// 글
posts.forEach((p, i) => {
  const s = seriesOf(p);
  let prev, next, prevLabel = '이전 글', nextLabel = '다음 글';
  if (s) {
    const j = s.posts.indexOf(p); prev = s.posts[j - 1]; next = s.posts[j + 1]; prevLabel = `이전 · ${prev?.part ?? ''}부`; nextLabel = `다음 · ${next?.part ?? ''}부`;
  } else { prev = posts[i + 1]; next = posts[i - 1]; }
  const seriesBox = s ? `<nav class="series" aria-label="연재 목차"><div class="series-h"><span>${esc(s.title)}</span><small>${p.part} / ${s.posts.length}부</small></div><ol>${s.posts.map((q) => `<li>${q === p ? `<span aria-current="page">${esc(q.title)}</span>` : `<a href="${q.url}">${esc(q.title)}</a>`}</li>`).join('')}</ol></nav>` : '';
  const pnav = prev || next ? `<nav class="pnav" aria-label="${prevLabel}·${nextLabel}">${prev ? `<a class="prev" href="${prev.url}"><small>← ${prevLabel}</small><span>${esc(prev.title)}</span></a>` : ''}${next ? `<a class="next" href="${next.url}"><small>${nextLabel} →</small><span>${esc(next.title)}</span></a>` : ''}</nav>` : '';
  emit(p.url, {
    title: p.title, type: 'article', description: p.summary || site.description, lastmod: p.date, toc: true,
    body: `<article>
<header class="post-head">
${s ? `<span class="kicker">${esc(s.title)}<span class="dot"></span>${p.part}부</span>` : ''}
<h1 class="post-title">${esc(p.title)}</h1>
<div class="post-meta"><time datetime="${p.date}">${krDate(p.date)}</time><span>약 ${p.minutes}분</span>${p.draft ? '<span>초안</span>' : ''}</div>
</header>
${seriesBox}
<div class="prose">
${mdToHtml(p.content)}
${p.tags.length ? `<p class="tags" aria-label="태그">${p.tags.map((t) => `<a href="${tagUrl(t)}">#${esc(t)}</a>`).join('')}</p>` : ''}
</div>
<footer class="post-foot">
${pnav}
</footer>
</article>`,
  });
});

// 고정 페이지(pages/*.md → /<slug>/)
for (const pg of load('pages')) {
  const title = String(pg.data.title ?? pg.slug);
  emit(`/${pg.slug}/`, { title, description: pg.data.description ? String(pg.data.description) : site.description,
    body: `<h1 class="page-title">${esc(title)}</h1>${pg.data.layout === 'links' ? `<div class="prose linkpage">${mdToHtml(pg.content, { linkPage: true })}</div>` : `<div class="prose">${mdToHtml(pg.content)}</div>`}` });
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
