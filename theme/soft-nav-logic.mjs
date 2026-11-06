// Pure helpers for same-origin soft navigation (tabs/tags). No DOM.
export const NAV_PAL_KEY = 'navPal';
export const NAV_COLORS = [
  { id: 'cream', bg: '#E3CDB1', fg: '#0E1013' },
  { id: 'olive', bg: '#7C5C3E', fg: '#FFFFFF' },
  { id: 'muted', bg: '#726A4D', fg: '#FFFFFF' },
  { id: 'terra', bg: '#AA5C3C', fg: '#FFFFFF' },
  { id: 'teal', bg: '#294F4F', fg: '#FFFFFF' },
];

export function colorById(id, colors = NAV_COLORS) {
  return colors.find((c) => c.id === id) || colors[0];
}

export function pickNextColor(curId, colors = NAV_COLORS, rand = Math.random) {
  const others = colors.filter((c) => c.id !== curId);
  return others[Math.floor(rand() * others.length)] || colors[0];
}

export function isModifiedClick(e) {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented;
}

/** Top-nav tab, tagbar chip, or home 꼭지 link — not article rows. */
export function isSoftNavClickTarget(el) {
  if (!el || el.tagName !== 'A' || !el.getAttribute('href')) return false;
  if (el.matches?.('.topnav .nav > a[href]')) return true;
  if (el.closest?.('.tagbar') && el.matches?.('a[href]')) return true;
  if (el.closest?.('.home-links') && el.matches?.('a[href]')) return true;
  return false;
}

export function samePath(aHref, locationHref) {
  try {
    const a = new URL(aHref, locationHref);
    const b = new URL(locationHref);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

export function canSoftNavigate(aHref, locationHref) {
  try {
    const a = new URL(aHref, locationHref);
    const b = new URL(locationHref);
    if (a.origin !== b.origin) return false;
    if (a.pathname === b.pathname && a.search === b.search) return false; // same page: let caller handle
    // hash-only on other pages ok; ignore pure hash on same path (already false above if path same)
    return true;
  } catch {
    return false;
  }
}

/**
 * Top-nav click plan. Cross-page soft nav: store new palette, apply after aria-current moves (not before).
 * Same-page: store+apply now, no navigation.
 */
export function planTopNavPaletteClick({ curId, samePage, rand = Math.random }) {
  const next = pickNextColor(curId, NAV_COLORS, rand);
  if (samePage) return { next, write: true, applyNow: true, softNav: false, preventDefault: true };
  return { next, write: true, applyNow: false, softNav: true, preventDefault: true, applyAfterSwap: true };
}

export function planSoftClick({ isTopNav, curId, samePage, modified, rand = Math.random }) {
  if (modified) return { action: 'native' };
  if (isTopNav) {
    const p = planTopNavPaletteClick({ curId, samePage, rand });
    if (samePage) return { action: 'palette-only', ...p };
    return { action: 'soft', ...p };
  }
  if (samePage) return { action: 'noop', preventDefault: true };
  return { action: 'soft', write: false, applyNow: false, softNav: true, preventDefault: true };
}

export function syncNavCurrent(links, pathname) {
  return links.map(({ href }) => {
    try {
      const path = new URL(href, 'https://example.com').pathname;
      let current = false;
      if (path === '/posts/') {
        current = pathname === '/posts/' || pathname.startsWith('/posts/') || pathname.startsWith('/tags/');
      } else if (path === '/about/') {
        current = pathname === '/about/' || pathname.startsWith('/about/');
      } else {
        current = pathname === path;
      }
      return { href, current };
    } catch {
      return { href, current: false };
    }
  });
}
