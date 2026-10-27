// artifact-report kit: 노션 스타일 단일 HTML 보고서의 블록·차트 조각과 조립 함수.
// 이 폴더(kit.mjs + template.html + vendor/)를 보고서 작업 폴더에 복사해서 쓴다. 설치할 패키지 없음(vendor/pele.mjs는 MIT 번들).
// 모든 조각은 HTML 문자열을 돌려준다. 이름이 body·html·Html로 끝나는 인자는 HTML 그대로, 나머지 글자는 escape한다.
import fs from 'node:fs';
import { render as peleRender, PeleError } from './vendor/pele.mjs';

// ---------- 기본 ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const fmtNum = (v) => (Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1));
export const pct = (a, b, digits = 0) => `${(b ? (a / b) * 100 : 0).toFixed(digits)}%`;
const share = (a, b) => `${(b ? Math.max(0, Math.min(1, a / b)) * 100 : 0).toFixed(2)}%`;

// 툴팁 속성. rows: [{ color, label, value }]. 키보드로도 열리게 tabindex를 붙인다.
export function tip(title, rows = [], note) {
  return ` tabindex="0" data-tip="${esc(JSON.stringify({ title: String(title ?? ''), rows: rows.map((r) => ({ ...r, value: String(r.value ?? '') })), note }))}"`;
}

// 받침에 맞춘 조사: josa('응답', '이', '가') → '이'
export function josa(word, withBatchim, without) {
  const m = String(word).match(/[가-힣](?=[^가-힣]*$)/);
  if (!m) return without;
  return (m[0].charCodeAt(0) - 0xac00) % 28 ? withBatchim : without;
}

// 문장 검사: 문장이 기대는 사실을 check로 적고, 파일을 쓰기 전에 assert를 부른다.
export function claims() {
  const broken = [];
  return {
    check(ok, msg) { if (!ok) broken.push(msg); return Boolean(ok); },
    assert() { if (broken.length) throw new Error(`데이터와 맞지 않는 문장 ${broken.length}개:\n- ${broken.join('\n- ')}`); },
  };
}

// 눈금: min~max를 1·2·2.5·5 단위로 나눈다
export function niceTicks(min, max, count = 4) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw - 1e-9);
  const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks.length > 1 ? ticks : [lo, lo + step];
}

// ---------- 색 ----------
// { color, ink }: 채우는 색과 그 위에 올리는 글자색. 라이트·다크 값은 template.html의 변수에 있다.
export const cat = (i) => ({ color: `var(--cat-${i})`, ink: `var(--cat-${i}-ink)` }); // 범주 1~8
export const div = (i) => ({ color: `var(--div-${i})`, ink: `var(--div-${i}-ink)` }); // 점수 1(나쁨)~5(좋음)
export const seq = (i) => ({ color: `var(--seq-${i})`, ink: `var(--seq-${i}-ink)` }); // 순서 1(낮음)~5(높음)
export const ACCENT = { color: 'var(--accent)', ink: 'var(--accent-ink)' };
export const NEUTRAL = { color: 'var(--neutral)', ink: 'var(--neutral-ink)' }; // 없음·기타·그 밖
export const SCALE5 = [1, 2, 3, 4, 5].map((v) => ({ label: `${v}점`, ...div(v) }));

// ---------- 블록 ----------
export const callout = ({ emoji = '💡', title, body = '', quiet = false }) =>
  `<div class="callout${quiet ? ' callout-quiet' : ''}"><span class="emoji" aria-hidden="true">${emoji}</span><div>${title ? `<p class="callout-title">${esc(title)}</p>` : ''}${body}</div></div>`;

export const kpis = (items) =>
  `<div class="kpis">${items.map(({ label, value, unit = '', sub }) => `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}<small>${esc(unit)}</small></div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}</div>`).join('')}</div>`;

// shadcn Card: 제목·설명 → 본문 → 해석(footerHtml) → 표로 보기(tableHtml)
export function card({ title, desc, body = '', footerHtml, tableHtml }) {
  const foot = footerHtml || tableHtml
    ? `<footer class="card-footer">${footerHtml ? `<div class="insight">${footerHtml}</div>` : ''}${tableHtml ? `<details class="tableview"><summary>표로 보기</summary>${tableHtml}</details>` : ''}</footer>`
    : '';
  return `<section class="card"><header class="card-header"><h4 class="card-title">${esc(title)}</h4>${desc ? `<p class="card-desc">${esc(desc)}</p>` : ''}</header><div class="card-content">${body}</div>${foot}</section>`;
}
export const grid2 = (...cardsHtml) => `<div class="grid-2">${cardsHtml.join('')}</div>`;

// 숫자 표(표로 보기·부록용). numericFrom 이후 칸은 오른쪽 정렬
export function dataTable(head, rows, { numericFrom = 1 } = {}) {
  const cls = (i) => (i >= numericFrom ? ' class="num"' : '');
  return `<div class="table-wrap"><table class="dtable"><thead><tr>${head.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// 노션 표. columns: [{ label, icon?, align?: 'c'|'r' }], rowsHtml: 칸마다 HTML(tag·chip을 넣을 수 있다)
export function notionTable(columns, rowsHtml) {
  const cls = (c, extra = '') => { const v = [c.align, extra].filter(Boolean).join(' '); return v ? ` class="${v}"` : ''; };
  return `<div class="table-wrap"><table class="ntable"><thead><tr>${columns.map((c) => `<th${cls(c)}>${c.icon ? `<span class="pi">${esc(c.icon)}</span>` : ''}${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rowsHtml.map((r) => `<tr>${r.map((cell, i) => `<td${cls(columns[i] ?? {}, i === 0 ? 'name' : '')}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export const legend = (items) => `<ul class="legend">${items.map(({ color, label }) => `<li><span class="sw" style="background:${color}"></span>${esc(label)}</li>`).join('')}</ul>`;
export const tag = (text, color) => `<span class="tag">${color ? `<span class="dot" style="background:${color}"></span>` : ''}${esc(text)}</span>`;
export const chip = (text, { color, ink } = ACCENT) => `<span class="chip" style="--fill:${color};--ink:${ink}">${esc(text)}</span>`;
export const toggle = ({ title, count, body = '', open = false }) =>
  `<details class="toggle"${open ? ' open' : ''}><summary><span class="toggle-title">${esc(title)}</span>${count != null ? `<span class="count-pill">${esc(count)}</span>` : ''}</summary><div class="toggle-body">${body}</div></details>`;
export const toggles = (...togglesHtml) => `<div class="toggles">${togglesHtml.join('')}</div>`;
export const quote = (text, caption) => `<blockquote class="quote"><p>${esc(text)}</p>${caption ? `<cite>${esc(caption)}</cite>` : ''}</blockquote>`;
export const bullets = (itemsHtml) => `<ul class="bullets">${itemsHtml.map((i) => `<li>${i}</li>`).join('')}</ul>`;
export const todo = (items) => `<ul class="todo">${items.map(({ title, desc }) => `<li><span class="box" aria-hidden="true"></span><div><b>${esc(title)}</b>${desc ? `<span>${esc(desc)}</span>` : ''}</div></li>`).join('')}</ul>`;
export const pageLink = (pageId, text) => `<a href="#${esc(pageId)}" class="page-link" data-page-link="${esc(pageId)}">${esc(text)}</a>`;
export const h2 = (text, ledeHtml) => `<h2>${esc(text)}</h2>${ledeHtml ? `<p class="lede">${ledeHtml}</p>` : ''}`;
export const h3 = (text, ledeHtml) => `<h3>${esc(text)}</h3>${ledeHtml ? `<p class="lede">${ledeHtml}</p>` : ''}`;
// 머메이드 문법 → 인라인 SVG(pele). 색은 template.html의 .mmd가 --pele-* 변수로 정해 라이트·다크가 한 벌이다.
// label은 스크린리더용 설명이다. 문법 오류는 줄·열과 해당 줄을 담아 던져 빌드를 멈춘다.
let mmdSeq = 0;
export function mermaid(text, { label = '', caption = '' } = {}) {
  const id = `mmd${++mmdSeq}`;
  let svg;
  try {
    svg = peleRender(text, { links: false, idPrefix: id }).svg;
  } catch (e) {
    if (e instanceof PeleError) throw new Error(`mermaid(${label || id}) ${e.code} ${e.line}:${e.column} ${e.message}\n${e.snippet}`);
    throw e;
  }
  return `<figure class="mmd"${label ? ` role="img" aria-label="${esc(label)}"` : ''}>${svg}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
}
export const appendix = (body) => `<section class="appendix">${body}</section>`;
export const foot = (text) => `<p class="foot">${esc(text)}</p>`;

// ---------- 차트 ----------
// 가로 막대: 항목마다 값 하나. total(또는 행의 total)을 주면 "값/전체"로, 없으면 가장 큰 값 기준으로 그린다.
// rows: [{ label, value, total?, color?, note?, labelHtml? }]
export function hbar(rows, { unit = '', total, note, fmt = fmtNum } = {}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return `<div class="hbar" role="list">${rows.map((r) => {
    const t = r.total ?? total, c = r.color ?? 'var(--accent)';
    const value = t != null ? `${fmt(r.value)}${unit} · ${pct(r.value, t)}` : `${fmt(r.value)}${unit}`;
    return `<div class="hbar-row" role="listitem"${tip(r.label, [{ color: c, label: t != null ? `${fmt(t)}${unit} 중` : '', value }], r.note ?? note)}>
<span class="hbar-label">${r.labelHtml ?? esc(r.label)}</span><span class="hbar-value"><b>${esc(fmt(r.value))}</b><span>${esc(t != null ? `/${fmt(t)}${unit}` : unit)}</span></span>
<span class="hbar-track"><span class="hbar-fill" style="width:${share(r.value, t ?? max)};background:${c}"></span></span></div>`;
  }).join('')}</div>`;
}

// 계열로 나눈 가로 막대: 한 막대를 계열(예: 두 집단)별 조각으로 나눈다.
// rows: [{ label, values: [계열별 값], total? }], series: [{ label, color }]
export function splitBar(rows, { series, unit = '', total, fmt = fmtNum, showLegend = true } = {}) {
  const max = Math.max(...rows.map((r) => sum(r.values)), 0);
  return `${showLegend ? legend(series) : ''}<div class="hbar" role="list">${rows.map((r) => {
    const n = sum(r.values), t = r.total ?? total;
    const tipRows = series.map((s, i) => ({ color: s.color, label: s.label, value: `${fmt(r.values[i])}${unit}` }));
    return `<div class="hbar-row" role="listitem"${tip(r.label, tipRows, t != null ? `${fmt(t)}${unit} 중 ${fmt(n)}${unit}` : `합계 ${fmt(n)}${unit}`)}>
<span class="hbar-label">${r.labelHtml ?? esc(r.label)}</span><span class="hbar-value"><b>${esc(fmt(n))}</b><span>${esc(t != null ? `/${fmt(t)}${unit}` : unit)}</span></span>
<span class="hbar-track split">${r.values.map((v, i) => (v > 0 ? `<span class="seg" style="width:${share(v, t ?? max)};background:${series[i].color}"></span>` : '')).join('')}</span></div>`;
  }).join('')}</div>`;
}

// 100% 누적 막대: 행마다 합을 100%로 놓고 구성비를 본다.
// rows: [{ label, values: [계열별 값] }], series: [{ label, color, ink }]
export function stack100(rows, { series, unit = '', rowLegend = false, fmt = fmtNum } = {}) {
  return `${rowLegend ? '' : legend(series)}<div class="stack" role="list">${rows.map((row) => {
    const n = sum(row.values);
    const segs = series.map((s, i) => ({ ...s, v: row.values[i] })).filter((s) => s.v > 0);
    return `<div class="stack-row" role="listitem"><span class="stack-label">${esc(row.label)}<small>${esc(`${fmt(n)}${unit}`)}</small></span>
<span class="stack-main"><span class="stack-bar">${segs.map((s, i) => `<span class="seg${i === 0 ? ' first' : ''}${i === segs.length - 1 ? ' last' : ''}" style="width:${share(s.v, n)};--fill:${s.color};--ink:${s.ink ?? 'var(--text)'}"${tip(`${row.label} · ${s.label}`, [{ color: s.color, label: s.label, value: `${fmt(s.v)}${unit} · ${pct(s.v, n)}` }])}>${s.v / n >= 0.05 ? `<i>${esc(fmt(s.v))}</i>` : ''}</span>`).join('')}</span>${rowLegend ? legend(segs.map((s) => ({ color: s.color, label: `${s.label} ${fmt(s.v)}${unit}` }))) : ''}</span></div>`;
  }).join('')}</div>`;
}

// 가운데 기준 분포: 홀수 개 척도(예: 1~5점)를 가운데 칸 기준으로 좌우에 쌓는다. 오른쪽 끝에 평균.
// rows: [{ label, counts: [척도별 인원], mean? }]
export function diverging(rows, { scale = SCALE5, unit = '명', hint = '← 낮음 · 높음 →', meanLabel = '평균', showMean = true } = {}) {
  const k = scale.length;
  if (k % 2 === 0) throw new Error('diverging: 척도는 홀수 개여야 한다');
  const mid = (k - 1) / 2;
  const reach = Math.max(...rows.map(({ counts: c }) => Math.max(sum(c.slice(0, mid)), sum(c.slice(mid + 1))) + c[mid] / 2), 1);
  const step = niceTicks(0, reach, 3)[1], D = reach * 1.06;
  const ticks = []; for (let v = 0; v <= D + 1e-9; v += step) ticks.push(v);
  const at = (x) => `${((x / (2 * D)) * 100).toFixed(3)}%`;
  const body = rows.map((r) => {
    const c = r.counts, n = sum(c);
    const segs = [];
    let x = D - c[mid] / 2;
    for (let i = mid - 1; i >= 0; i--) { segs.unshift({ i, from: x - c[i], to: x }); x -= c[i]; }
    segs.push({ i: mid, from: D - c[mid] / 2, to: D + c[mid] / 2 });
    x = D + c[mid] / 2;
    for (let i = mid + 1; i < k; i++) { segs.push({ i, from: x, to: x + c[i] }); x += c[i]; }
    const shown = segs.filter((s) => c[s.i] > 0);
    const mean = r.mean ?? (n ? sum(c.map((v, i) => v * (i + 1))) / n : 0);
    return `<div class="dv-row"><span class="dv-label">${esc(r.label)}</span>
<span class="dv-plot">${shown.map((s, j) => `<span class="seg${j === 0 ? ' first' : ''}${j === shown.length - 1 ? ' last' : ''}" style="left:${at(s.from)};width:${at(s.to - s.from)};--fill:${scale[s.i].color};--ink:${scale[s.i].ink}"${tip(`${r.label} · ${scale[s.i].label}`, [{ color: scale[s.i].color, label: `${n}${unit} 중`, value: `${c[s.i]}${unit}` }])}><i>${c[s.i]}</i></span>`).join('')}</span>
<span class="dv-mean">${showMean ? `<b>${mean.toFixed(1)}</b><small>${esc(meanLabel)}</small>` : ''}</span></div>`;
  }).join('');
  const axis = `<div class="dv-row dv-axis" aria-hidden="true"><span></span><span class="dv-plot">${[...ticks].reverse().map((v) => `<em style="left:${at(D - v)}">${v}</em>`).join('')}${ticks.filter((v) => v > 0).map((v) => `<em style="left:${at(D + v)}">${v}</em>`).join('')}</span><span></span></div>`;
  return `<div class="dv-head">${legend(scale)}<span class="dv-hint">${esc(hint)}</span></div><div class="dv">${body}${axis}</div>`;
}

// 두 값 비교(아령): 행마다 두 계열의 값을 같은 축에 찍고 선으로 잇는다.
// rows: [{ label, values: [a, b], notes?: [a 설명, b 설명] }], series: [{ label, color }, { label, color }]
export function dumbbell(rows, { series, min, max, ticks, unit = '', fmt = (v) => v.toFixed(1) } = {}) {
  const all = rows.flatMap((r) => r.values);
  ticks ??= niceTicks(min ?? Math.min(...all), max ?? Math.max(...all), 4);
  const lo = min ?? ticks[0], hi = max ?? ticks.at(-1), span = hi - lo || 1;
  const pos = (v) => `${(((v - lo) / span) * 100).toFixed(3)}%`;
  const body = rows.map((r) => {
    const [a, b] = r.values, close = Math.abs(a - b) < span * 0.18;
    const dot = (v, i, below) => `<span class="db-dot" style="left:${pos(v)};--fill:${series[i].color}"${tip(`${r.label} · ${series[i].label}`, [{ color: series[i].color, label: series[i].label, value: `${fmt(v)}${unit}` }], r.notes?.[i])}></span><span class="db-val${below ? ' below' : ''}" style="left:${pos(v)}">${esc(fmt(v))}</span>`;
    return `<div class="db-row"><span class="db-label">${esc(r.label)}</span><span class="db-plot"><span class="db-grid">${ticks.map((v) => `<i style="left:${pos(v)}"></i>`).join('')}</span><span class="db-scale">
<span class="db-line" style="left:${pos(Math.min(a, b))};width:calc(${pos(Math.max(a, b))} - ${pos(Math.min(a, b))})"></span>${dot(a, 0, close && a < b)}${dot(b, 1, close && b <= a)}</span></span></div>`;
  }).join('');
  const axis = `<div class="db-row db-axis" aria-hidden="true"><span></span><span class="db-plot"><span class="db-scale">${ticks.map((v) => `<em style="left:${pos(v)}">${esc(`${fmtNum(v)}${unit}`)}</em>`).join('')}</span></span></div>`;
  return `${legend(series)}<div class="db">${body}${axis}</div>`;
}

// 점 그래프: 행마다 여러 점(사람·항목)을 x값 위치에 찍는다. 겹치는 점은 화면 폭에 맞춰 template.html의 스크립트가 위아래 줄로 비켜 놓는다.
// rows: [{ label, dots: [{ value, text?, color, ink, title?, tipRows?, note? }] }]. text가 3자 이상이면 알약 모양.
export function dotPlot(rows, { min = 0, max, ticks, unit = '', fmt = fmtNum, labelWidth = '4rem' } = {}) {
  const all = rows.flatMap((r) => r.dots.map((d) => d.value));
  ticks ??= niceTicks(min, max ?? Math.max(...all, min + 1), 5);
  const lo = ticks[0], hi = ticks.at(-1), span = hi - lo || 1;
  const pos = (v) => ((v - lo) / span) * 100;
  const pill = (d) => String(d.text ?? '').length > 2;
  const body = rows.map((r) => {
    const dots = [...r.dots].sort((a, b) => a.value - b.value);
    return `<div class="dp-row"><span class="dp-label">${esc(r.label)}</span><span class="dp-plot"><span class="dp-grid">${ticks.map((v) => `<i style="left:${pos(v).toFixed(2)}%"></i>`).join('')}</span>${dots.map((d) => `<span class="dp-dot${pill(d) ? ' pill' : ''}" style="left:${pos(d.value).toFixed(2)}%;top:50%;--fill:${d.color ?? 'var(--accent)'};--ink:${d.ink ?? 'var(--accent-ink)'}"${tip(d.title ?? d.text ?? r.label, d.tipRows ?? [{ color: d.color ?? 'var(--accent)', label: r.label, value: `${fmt(d.value)}${unit}` }], d.note)}>${esc(d.text ?? '')}</span>`).join('')}</span></div>`;
  }).join('');
  const axis = `<div class="dp-row dp-axis" aria-hidden="true"><span class="dp-label"></span><span class="dp-plot">${ticks.map((v) => `<em style="left:${pos(v).toFixed(2)}%">${esc(`${fmt(v)}${unit}`)}</em>`).join('')}</span></div>`;
  return `<div class="dp" style="--dp-label:${labelWidth}">${body}${axis}</div>`;
}

// 세로 막대: 날짜·점수처럼 순서 있는 항목마다 값 하나. series를 주면 계열별로 아래부터 쌓는다.
// items: [{ label, sub?, value } | { label, sub?, values: [계열별 값] }]
export function columns(items, { series, unit = '', height = 112, maxWidth, noteHtml, fmt = fmtNum } = {}) {
  const totals = items.map((it) => (it.values ? sum(it.values) : it.value));
  const max = Math.max(...totals, 1), n = items.length;
  const cols = items.map((it, j) => {
    const vals = it.values ?? [it.value];
    const ser = series ?? [{ label: it.seriesLabel ?? '', color: it.color ?? 'var(--accent)' }];
    const tipRows = vals.map((v, i) => ({ color: ser[i].color, label: ser[i].label, value: `${fmt(v)}${unit}` }));
    return `<div class="col"${tip(it.title ?? `${it.label}${it.sub ? ` (${it.sub})` : ''}`, tipRows, it.note)}><span class="col-val">${esc(fmt(totals[j]))}</span><span class="col-stack">${vals.map((v, i) => (v > 0 ? `<span class="col-seg" style="height:${((v / max) * height).toFixed(1)}px;background:${ser[i].color}"></span>` : '')).join('')}</span></div>`;
  }).join('');
  return `<div class="cols-wrap"${maxWidth ? ` style="--cols-max:${maxWidth}px"` : ''}>${series ? legend(series) : ''}<div class="cols" style="--n:${n};height:${height + 38}px">${cols}</div>
<div class="cols-x" style="--n:${n}">${items.map((it) => `<span>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>`).join('')}</div>${noteHtml ? `<p class="cols-note">${noteHtml}</p>` : ''}</div>`;
}

// 선 그래프: x 레이블마다 계열별 값 하나(null이면 끊는다). 세로 띠에 올리면 그 x의 모든 계열 값을 보여 준다.
// series: [{ label, color, values: [...] }]. area(면 채우기)는 계열이 하나일 때만 그린다(겹치면 색이 섞여 탁해진다).
export function lineChart({ labels, series, min = 0, max, ticks, unit = '', area = false, height = 200, fmt = fmtNum, xEvery }) {
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  ticks ??= niceTicks(min, max ?? Math.max(...all, min + 1), 4);
  const lo = ticks[0], hi = ticks.at(-1), span = hi - lo || 1, n = labels.length;
  const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v) => 100 - ((v - lo) / span) * 100;
  const every = xEvery ?? Math.max(1, Math.ceil(n / 8));
  const runs = (vals) => { const out = [[]]; vals.forEach((v, i) => (v == null ? out.push([]) : out.at(-1).push([x(i), y(v)]))); return out.filter((r) => r.length); };
  const pts = (run) => run.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(' ');
  const fillArea = area && series.length === 1;
  const svg = series.map((s) => runs(s.values).map((run) => `${fillArea && run.length > 1 ? `<polygon class="lc-fill" style="--fill:${s.color}" points="${pts(run)} ${run.at(-1)[0].toFixed(2)},100 ${run[0][0].toFixed(2)},100"/>` : ''}<polyline class="lc-line" style="--fill:${s.color}" points="${pts(run)}"/>`).join('')).join('');
  const dots = series.map((s) => s.values.map((v, i) => (v == null ? '' : `<span class="lc-dot" style="left:${x(i).toFixed(2)}%;top:${y(v).toFixed(2)}%;--fill:${s.color}"></span>`)).join('')).join('');
  const hits = labels.map((lab, i) => {
    const from = i === 0 ? 0 : (x(i - 1) + x(i)) / 2, to = i === n - 1 ? 100 : (x(i) + x(i + 1)) / 2;
    const at = to > from ? ((x(i) - from) / (to - from)) * 100 : 50;
    return `<span class="lc-hit" style="left:${from.toFixed(2)}%;width:${(to - from).toFixed(2)}%;--at:${at.toFixed(1)}%"${tip(lab, series.map((s) => ({ color: s.color, label: s.label, value: s.values[i] == null ? '-' : `${fmt(s.values[i])}${unit}` })))}></span>`;
  }).join('');
  const grid = ticks.map((v) => `<span class="lc-grid${v === lo ? ' base' : ''}" style="top:${y(v).toFixed(2)}%"><em>${esc(`${fmt(v)}${unit}`)}</em></span>`).join('');
  return `${series.length > 1 ? legend(series) : ''}<div class="lc" style="--h:${height}px"><div class="lc-area">${grid}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${dots}${hits}</div></div>
<div class="lc-x">${labels.map((lab, i) => (i % every === 0 || i === n - 1 ? `<em style="left:${x(i).toFixed(2)}%">${esc(lab)}</em>` : '')).join('')}</div>`;
}

// ---------- 조립 ----------
// pages: [{ id, icon, title, nav?, cover?: 1|2|3, props?: [{ icon, name, valueHtml }], body }]
// id는 주소(#id)와 테마 저장 key에 쓰인다. defaultTheme: 'light'|'dark'(없으면 기기 설정을 따른다)
export function render({ title, id, lang = 'ko', defaultTheme, ws = {}, footHtml = '', pages, template, sample = false }) {
  if (!title) throw new Error('render: title이 필요하다');
  if (!pages?.length) throw new Error('render: 페이지가 하나 이상 필요하다');
  if (defaultTheme && !['light', 'dark'].includes(defaultTheme)) throw new Error(`render: defaultTheme은 light 또는 dark다 (${defaultTheme})`);
  const seen = new Set();
  for (const p of pages) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(p.id) || ['light', 'dark'].includes(p.id.toLowerCase())) throw new Error(`render: 페이지 id는 영문·숫자·-만 쓰고 light/dark는 피한다 (${p.id})`);
    if (seen.has(p.id)) throw new Error(`render: 페이지 id가 겹친다 (${p.id})`);
    seen.add(p.id);
  }
  const article = (p, i) => `<article class="doc" data-page="${esc(p.id)}" data-title="${esc(p.title)}" data-icon="${esc(p.icon ?? '')}" data-nav="${esc(p.nav ?? p.title)}"${sample ? ' data-sample' : ''}${i ? ' hidden' : ''}>
<div class="cover${p.cover > 1 ? ` cover-${p.cover}` : ''}" aria-hidden="true"></div>
<div class="page">
<div class="page-icon" aria-hidden="true">${esc(p.icon ?? '')}</div>
<h1 class="title">${esc(p.title)}</h1>
${p.props?.length ? `<div class="props">${p.props.map((q) => `<div class="prop"><span class="prop-name"><span class="pi">${esc(q.icon ?? '')}</span>${esc(q.name)}</span><span>${q.valueHtml ?? esc(q.value)}</span></div>`).join('')}</div>` : ''}
${p.body ?? ''}
</div>
</article>`;
  let html = fs.readFileSync(template ?? new URL('./template.html', import.meta.url), 'utf8');
  const swap = (name, value) => {
    const re = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`);
    if (!re.test(html)) throw new Error(`template.html에 ${name} 표식이 없다`);
    html = html.replace(re, () => `<!-- ${name}:start -->${value}<!-- ${name}:end -->`);
  };
  swap('ws', `<span class="sb-ws-icon" aria-hidden="true">${esc(ws.icon ?? pages[0].icon ?? '')}</span><span class="sb-ws-name">${esc(ws.name ?? title)}</span>`);
  swap('foot', footHtml);
  swap('pages', `\n${pages.map(article).join('\n')}\n`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`);
  html = html.replace(/<html[^>]*>/, () => `<html lang="${esc(lang)}" data-report-id="${esc(id ?? title)}"${defaultTheme ? ` data-default-theme="${defaultTheme}"` : ''}>`);
  return html;
}
