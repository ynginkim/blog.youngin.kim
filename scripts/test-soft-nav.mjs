import {
  pickNextColor, colorById, isModifiedClick, canSoftNavigate, isSameDocumentUrl,
  planSoftClick, syncNavCurrent, NAV_COLORS, normalizeUrlParts, isSoftNavClickTarget,
} from '../theme/soft-nav-logic.mjs';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function L(h){h=h.slice(1);const[r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);const f=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;const[R,G,B]=[r,g,b].map(f);return 0.2126*R+0.7152*G+0.0722*B}
function C(a,b){const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
for (const c of NAV_COLORS) assert(C(c.bg,c.fg)>=4.5, 'contrast '+c.id);

assert(pickNextColor('cream', NAV_COLORS, () => 0).id !== 'cream', 'pick different');
assert(isModifiedClick({ button:0, metaKey:true, ctrlKey:false, shiftKey:false, altKey:false, defaultPrevented:false }), 'meta');

const loc = 'https://blog.youngin.kim/posts/tags/AI/';
const posts = 'https://blog.youngin.kim/posts/';
const about = 'https://blog.youngin.kim/about/';
const home = 'https://blog.youngin.kim/';

// CRITICAL: tag page vs /posts/ are NOT the same document (even if 글 has aria-current)
assert(!isSameDocumentUrl(posts, loc), 'tag→posts not same');
assert(canSoftNavigate(posts, loc), 'tag→posts can soft');
assert(isSameDocumentUrl(loc, loc), 'tag same self');
assert(!canSoftNavigate(loc, loc), 'tag self no soft');

// path/query/hash exactness
assert(!isSameDocumentUrl('https://blog.youngin.kim/posts/?q=1', 'https://blog.youngin.kim/posts/'), 'query differs');
assert(!isSameDocumentUrl('https://blog.youngin.kim/posts/#x', 'https://blog.youngin.kim/posts/'), 'hash differs');
assert(isSameDocumentUrl('https://blog.youngin.kim/posts/', 'https://blog.youngin.kim/posts/'), 'posts equal');

// From tag page, topnav 글 must soft-nav (not palette-only), and change palette
const fromTag = planSoftClick({ isTopNav:true, curId:'terra', samePage:isSameDocumentUrl(posts, loc), modified:false, rand:()=>0 });
assert(fromTag.action === 'soft', 'tag 글 click soft not palette-only: '+fromTag.action);
assert(fromTag.write && fromTag.applyAfterSwap && !fromTag.applyNow, 'apply after swap');
assert(fromTag.next.id !== 'terra', 'palette differs from terra');

// Same exact /posts/: palette only
const onPosts = planSoftClick({ isTopNav:true, curId:'olive', samePage:true, modified:false, rand:()=>0 });
assert(onPosts.action === 'palette-only' && onPosts.applyNow && onPosts.next.id !== 'olive', 'same path palette');

// about ↔ posts palette persists via write + differs
const toAbout = planSoftClick({ isTopNav:true, curId:'cream', samePage:false, modified:false, rand:()=>0 });
assert(toAbout.action==='soft' && toAbout.write && toAbout.next.id!=='cream', 'to about');
const backPosts = planSoftClick({ isTopNav:true, curId:toAbout.next.id, samePage:false, modified:false, rand:()=>0.99 });
assert(backPosts.write && backPosts.next.id !== toAbout.next.id, 'return posts different pal');

// brand / tag soft without palette write
const brand = planSoftClick({ isTopNav:false, curId:'terra', samePage:isSameDocumentUrl(home, loc), modified:false });
assert(brand.action==='soft' && !brand.write, 'brand from tag soft no pal write');

const tagChip = planSoftClick({ isTopNav:false, curId:'terra', samePage:false, modified:false });
assert(tagChip.action==='soft' && !tagChip.write, 'tag chip');

// sync: 글 current on tag pages, but that must not imply sameDocument
const links=[{href:posts},{href:about}];
assert(syncNavCurrent(links,'/posts/tags/AI/').map(x=>x.current).join()==='true,false', 'sync tag highlights 글');
assert(!isSameDocumentUrl(posts, 'https://blog.youngin.kim/posts/tags/AI/'), 'sync highlight ≠ same url');

// soft target helpers (jsdom-less: matches via fake)
const fake = (sel) => ({ tagName:'A', getAttribute:()=>'/x', matches:(s)=>s===sel, closest:()=>null });
assert(isSoftNavClickTarget({ tagName:'A', getAttribute:()=>'/posts/', matches:(s)=>s==='.topnav .nav > a[href]', closest:()=>null }), 'topnav');
assert(isSoftNavClickTarget({ tagName:'A', getAttribute:()=>'/', matches:(s)=>s==='.topnav a.brand[href]', closest:()=>null }), 'brand');

console.log('test-soft-nav: ok');
