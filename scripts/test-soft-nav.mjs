import {
  pickNextColor, colorById, isModifiedClick, canSoftNavigate, samePath,
  planSoftClick, syncNavCurrent, NAV_COLORS,
} from '../theme/soft-nav-logic.mjs';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// contrast
function L(h){h=h.slice(1);const[r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);const f=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;const[R,G,B]=[r,g,b].map(f);return 0.2126*R+0.7152*G+0.0722*B}
function C(a,b){const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
for (const c of NAV_COLORS) assert(C(c.bg,c.fg)>=4.5, 'contrast '+c.id);

// pick different
const next = pickNextColor('cream', NAV_COLORS, () => 0);
assert(next.id !== 'cream', 'pick different');

// modifiers
assert(isModifiedClick({ button:0, metaKey:true, ctrlKey:false, shiftKey:false, altKey:false, defaultPrevented:false }), 'meta');
assert(!isModifiedClick({ button:0, metaKey:false, ctrlKey:false, shiftKey:false, altKey:false, defaultPrevented:false }), 'plain');

// can soft
assert(canSoftNavigate('https://blog.youngin.kim/about/', 'https://blog.youngin.kim/posts/'), 'cross');
assert(!canSoftNavigate('https://blog.youngin.kim/posts/', 'https://blog.youngin.kim/posts/'), 'same');
assert(!canSoftNavigate('https://other/x', 'https://blog.youngin.kim/posts/'), 'ext');

// plans
const topCross = planSoftClick({ isTopNav:true, curId:'cream', samePage:false, modified:false, rand:()=>0 });
assert(topCross.action==='soft' && topCross.write && topCross.next.id!=='cream' && topCross.applyNow===false, 'top cross');

const topSame = planSoftClick({ isTopNav:true, curId:'cream', samePage:true, modified:false, rand:()=>0 });
assert(topSame.action==='palette-only' && topSame.applyNow, 'top same');

const tagCross = planSoftClick({ isTopNav:false, curId:'cream', samePage:false, modified:false });
assert(tagCross.action==='soft' && !tagCross.write, 'tag cross no pal');

const tagSame = planSoftClick({ isTopNav:false, curId:'cream', samePage:true, modified:false });
assert(tagSame.action==='noop', 'tag same');

const mod = planSoftClick({ isTopNav:true, curId:'cream', samePage:false, modified:true });
assert(mod.action==='native', 'mod native');

// sync active menu
const links=[{href:'https://blog.youngin.kim/posts/'},{href:'https://blog.youngin.kim/about/'}];
assert(syncNavCurrent(links,'/posts/').map(x=>x.current).join()==='true,false', 'posts');
assert(syncNavCurrent(links,'/posts/ai-x/').map(x=>x.current).join()==='true,false', 'article keeps 글');
assert(syncNavCurrent(links,'/about/').map(x=>x.current).join()==='false,true', 'about');
assert(syncNavCurrent(links,'/posts/tags/배움/').map(x=>x.current).join()==='true,false', 'tag');

// hard-nav flash regression: cross-page topnav must not applyNow
assert(topCross.applyNow===false, 'no apply on outgoing hard/soft plan before swap');

console.log('test-soft-nav: ok');
