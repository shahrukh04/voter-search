/**
 * Search engine — a direct port of the legacy app's matching pipeline.
 * Data lives in MongoDB; the client keeps the (small) ward dataset in memory
 * so results stay instant and the matra-insensitive matching stays exact.
 */
import { ALIAS, bestScore, rawN, skelWord, skelWords, toAscii } from './hindi.js';

export const PAGE_V = 30;
export const PAGE_F = 30;

export const SORTS = {
  voters: [
    ['rel', 'प्रासंगिकता / वार्ड क्रम'],
    ['az', 'नाम A–Z'],
    ['za', 'नाम Z–A'],
    ['ageu', 'आयु: छोटे → बड़े'],
    ['aged', 'आयु: बड़े → छोटे'],
    ['serial', 'वार्ड + क्रमांक'],
  ],
  family: [
    ['rel', 'प्रासंगिकता / वार्ड क्रम'],
    ['big', 'सदस्य: ज़्यादा → कम'],
    ['small', 'सदस्य: कम → ज़्यादा'],
    ['hno', 'मकान संख्या क्रम'],
    ['old', 'सबसे बड़े सदस्य की आयु'],
  ],
};

/** Search modes: which name fields the typed words are matched against. */
export const SMODES = [
  ['naam', 'नाम से'],
  ['pita', 'पिता/पति से'],
  ['dono', 'नाम + पिता/पति'],
];
export const SMODE_PLACEHOLDER = {
  naam: 'नाम लिखें — मात्रा की चिंता नहीं: रमेश / ramesh / 145',
  pita: 'पिता/पति का नाम लिखें — जैसे रामलाल / ramlal',
  dono: 'मतदाता का नाम लिखें — जैसे सुरेश (पिता/पति का नाम नीचे)',
};
export const REL_PLACEHOLDER = 'पिता/पति का नाम — जैसे रामलाल / ramlal';

export const defaultState = {
  q: '',
  q2: '',
  smode: 'naam',
  ward: '',
  moh: '',
  g: '',
  rel: '',
  amin: '',
  amax: '',
  h: '',
  l: '',
  e: '',
  sort: 'rel',
  fa: false,
  dup: false,
  del: false,
  view: 'voters',
};

const coll = (() => {
  try { return new Intl.Collator('hi'); } catch (e) { return new Intl.Collator(); }
})();

export const validH = (r) => !!r.h && r.h !== '0' && r.h !== '00';
export const houseKey = (r) => r.w + '|' + r.h + '|' + r.m;

// Every record carries a list label: "मूल सूची" (main roll) or a supplementary one
// (the source PDFs use "परिवर्धन सूची"). Treat anything that is not the main roll as supplementary.
export const isOrigList = (r) => !r.l || r.l.includes('मूल');
export const isSupList = (r) => !!r.l && !r.l.includes('मूल');

/** Enrich the raw records and build the family index. */
export function prepare(rawRecords, edits = {}) {
  const DATA = rawRecords.map((rec, index) => ({ ...rec, i: rec.i ?? index }));

  // Apply corrections (क्रमांक / वार्ड सुधार)
  DATA.forEach((r) => {
    if (r.w0 === undefined) { r.w0 = r.w; r.s0 = r.s; }
    const e = edits[r.i];
    if (e && e.n === r.n) { r.w = +e.w; r.s = String(e.s); r.ed = 1; } else { r.w = r.w0; r.s = r.s0; r.ed = 0; }
  });

  const WARDS = [...new Set(DATA.map((r) => r.w))].sort((a, b) => a - b);
  const epicCount = new Map();
  const fpCount = new Map();

  DATA.forEach((r) => {
    r.nw = skelWords(r.n);
    r.rw = skelWords(r.rn);
    r.nr = rawN(r.n).split(/[\s,.\-/]+/).filter(Boolean);
    r.rr = rawN(r.rn).split(/[\s,.\-/]+/).filter(Boolean);
    r.ek = (r.e || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    r.fp = [r.n, r.rn, r.a, r.g].join('|');
    if (!r.d) {
      if (r.ek) epicCount.set(r.ek, (epicCount.get(r.ek) || 0) + 1);
      fpCount.set(r.fp, (fpCount.get(r.fp) || 0) + 1);
    }
  });

  DATA.forEach((r) => {
    r.dup = r.d ? 0 : (r.ek && epicCount.get(r.ek) > 1 ? 1 : fpCount.get(r.fp) > 1 ? 2 : 0);
  });

  const FAM = new Map();
  DATA.forEach((r) => {
    if (r.d || !validH(r)) return;
    const k = houseKey(r);
    let f = FAM.get(k);
    if (!f) { f = { k, w: r.w, h: r.h, m: r.m, mem: [], _s: 0 }; FAM.set(k, f); }
    f.mem.push(r);
  });

  FAM.forEach((f) => {
    f.mem.sort((a, b) => (b.a ?? 0) - (a.a ?? 0));
    f.n = f.mem.length;
    f.male = f.mem.filter((x) => x.g === 'पुरुष').length;
    f.fem = f.n - f.male;
    const ag = f.mem.map((x) => x.a).filter((a) => a !== null);
    f.avg = ag.length ? Math.round(ag.reduce((a, b) => a + b, 0) / ag.length) : 0;
    f.sen = f.mem.filter((x) => x.a >= 60).length;
    f.old = f.mem[0];
    const hn = parseInt(toAscii(f.h), 10);
    f.hn = isNaN(hn) ? 999999 : hn;
  });

  return { DATA, FAM, WARDS, ACT: DATA.filter((r) => !r.d).length, FAMCOUNT: FAM.size };
}

/* ---------- query parsing ---------- */
export function parseQuery(q) {
  q = toAscii(q).trim();
  const toks = q.split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of toks) {
    if (/^\d+$/.test(t)) out.push({ t: 'house', v: t });
    else if (/\d/.test(t) && (/[a-z]/i.test(t) || t.includes('/')) && t.length >= 3) out.push({ t: 'epic', v: t.toLowerCase().replace(/[^a-z0-9]/g, '') });
    else {
      const al = ALIAS[t.toLowerCase()];
      if (al === '') continue;
      const tt = al || t;
      const s = skelWord(tt);
      if (s) out.push({ t: 'name', v: s, raw: rawN(tt) });
    }
  }
  return out;
}

/**
 * Build the match-token list for the active mode. Each name-token gets an `f`
 * field telling scoreRec which name column it must match:
 *   'n' → मतदाता का नाम      'r' → पिता/पति का नाम      'b' → दोनों में से कोई
 * "dono" mode shows two boxes (q = मतदाता का नाम, q2 = पिता/पति का नाम); जब दूसरा
 * खाली हो तो अकेला नाम दोनों कॉलम में ढूँढा जाता है (पुराना व्यवहार)।
 */
export function buildTokens(S) {
  const mode = S.smode || 'naam';
  const out = [];
  const add = (arr, f) => arr.forEach((k) => out.push({ ...k, f }));
  if (mode === 'pita') {
    add(parseQuery(S.q), 'r');
  } else if (mode === 'dono') {
    const two = !!(S.q2 && S.q2.trim());
    add(parseQuery(S.q), two ? 'n' : 'b');
    if (two) add(parseQuery(S.q2), 'r');
  } else {
    add(parseQuery(S.q), 'n');
  }
  return out;
}

function rawBoost(raw, words) {
  let b = 0;
  for (const w of words) {
    if (w === raw) return 45;
    if (w.startsWith(raw)) b = Math.max(b, 25);
  }
  return b;
}

/**
 * Returns { s, mn } — s = 0 means "no match".
 * Har name-token ka `f` तय करता है कि वह किस कॉलम से मेल खाए:
 *   'r' → सिर्फ़ पिता/पति का नाम
 *   'n' → मतदाता का नाम (fa हो तो पिता/पति पर हल्का fallback)
 *   'b' → दोनों में से किसी भी एक
 * हर शब्द का मेल ज़रूरी है (AND)।
 */
function scoreRec(r, toks, fa) {
  let total = 0;
  let mn = 999;
  for (const k of toks) {
    let s = 0;
    if (k.t === 'house') s = r.h === k.v ? 120 : r.h.startsWith(k.v) ? 60 : 0;
    else if (k.t === 'epic') s = r.ek.includes(k.v) ? 120 : 0;
    else if (k.f === 'r') {
      s = bestScore(k.v, r.rw);
      if (s) s += rawBoost(k.raw, r.rr);
    } else if (k.f === 'b') {
      const sn = bestScore(k.v, r.nw);
      const sr = bestScore(k.v, r.rw);
      s = Math.max(sn, sr);
      if (s) s += Math.max(sn ? rawBoost(k.raw, r.nr) : 0, sr ? rawBoost(k.raw, r.rr) : 0);
    } else {
      s = bestScore(k.v, r.nw);
      if (s) s += rawBoost(k.raw, r.nr);
      if (fa) { const s2 = Math.round(bestScore(k.v, r.rw) * 0.55); if (s2 > s) s = s2; }
    }
    if (!s) return { s: 0, mn: 0 };
    if (s < mn) mn = s;
    total += s;
  }
  return { s: total, mn };
}

function baseFilter(DATA, S, skipWard) {
  const amin = S.amin === '' ? 0 : +S.amin;
  const amax = S.amax === '' ? 999 : +S.amax;
  return DATA.filter((r) => {
    if (r.d && !S.del) return false;
    if (!skipWard && S.ward && r.w !== +S.ward) return false;
    if (S.moh && r.m !== S.moh) return false;
    if (S.g && r.g !== S.g) return false;
    if (S.rel && r.rel !== S.rel) return false;
    if (r.a !== null && (r.a < amin || r.a > amax)) return false;
    if (r.a === null && (S.amin !== '' || S.amax !== '')) return false;
    if (S.h && r.h !== toAscii(S.h).trim()) return false;
    if (S.l === 'orig' && !isOrigList(r)) return false;
    if (S.l === 'sup' && !isSupList(r)) return false;
    if (S.e === 'yes' && !r.e) return false;
    if (S.e === 'no' && r.e) return false;
    if (S.dup && !r.dup) return false;
    return true;
  });
}

/** Full run: returns results, per-ward counts and match set. */
export function run(ctx, S) {
  const { DATA, FAM } = ctx;
  const toks = buildTokens(S);
  let list = baseFilter(DATA, S, false);
  let wardPool = baseFilter(DATA, S, true);

  if (toks.length) {
    const scan = (arr) => {
      const hit = [];
      for (const r of arr) {
        const { s, mn } = scoreRec(r, toks, S.fa);
        if (s) hit.push([r, s, mn]);
      }
      const strict = hit.filter((h) => h[2] >= 60);
      return strict.length >= 10 ? strict : hit;
    };
    list = scan(list).map(([r, s]) => { r._s = s; return r; });
    wardPool = scan(wardPool).map((h) => h[0]);
  }

  const MATCH = toks.length ? new Set(list.map((r) => r.i)) : null;
  const wardCnt = {};
  let RES = [];
  let NOHOUSE = 0;

  if (S.view === 'voters') {
    const by = {
      rel: (a, b) => (toks.length ? b._s - a._s || a.w - b.w || +a.s - +b.s : a.w - b.w || +a.s - +b.s),
      az: (a, b) => coll.compare(a.n, b.n) || a.w - b.w,
      za: (a, b) => coll.compare(b.n, a.n) || a.w - b.w,
      ageu: (a, b) => (a.a ?? 999) - (b.a ?? 999) || coll.compare(a.n, b.n),
      aged: (a, b) => (b.a ?? -1) - (a.a ?? -1) || coll.compare(a.n, b.n),
      serial: (a, b) => a.w - b.w || +a.s - +b.s,
    };
    list.sort(by[S.sort] || by.rel);
    RES = list;
    wardPool.forEach((r) => { wardCnt[r.w] = (wardCnt[r.w] || 0) + 1; });
  } else {
    const keys = new Map();
    for (const r of list) {
      if (r.d) continue;
      if (!validH(r)) { NOHOUSE++; continue; }
      const k = houseKey(r);
      const s = toks.length ? r._s || 0 : 0;
      if (!keys.has(k) || keys.get(k) < s) keys.set(k, s);
    }
    RES = [...keys].map(([k, s]) => { const f = FAM.get(k); if (f) f._s = s; return f; }).filter(Boolean);
    const by = {
      rel: (a, b) => (toks.length ? b._s - a._s || a.w - b.w || a.hn - b.hn : a.w - b.w || a.hn - b.hn || coll.compare(a.m, b.m)),
      big: (a, b) => b.n - a.n || a.w - b.w || a.hn - b.hn,
      small: (a, b) => a.n - b.n || a.w - b.w || a.hn - b.hn,
      hno: (a, b) => a.hn - b.hn || a.w - b.w,
      old: (a, b) => (b.old?.a ?? 0) - (a.old?.a ?? 0),
    };
    RES.sort(by[S.sort] || by.rel);
    const seen = {};
    wardPool.forEach((r) => {
      if (r.d || !validH(r)) return;
      const k = houseKey(r);
      if (seen[k]) return;
      seen[k] = 1;
      wardCnt[r.w] = (wardCnt[r.w] || 0) + 1;
    });
  }

  return { toks, RES, wardCnt, NOHOUSE, MATCH };
}

/**
 * Name suggestions for a search box. `side` picks which box is being typed:
 *   'n' → मतदाता का नाम (q)      'r' → पिता/पति का नाम (pita mode या dono का दूसरा box)
 * बाक़ी सभी तोकन AND-फ़िल्टर की तरह लगाए जाते हैं, ताकि दो-नाम वाली खोज में
 * सुझाव उसी व्यक्ति के हों जिसमें दूसरा नाम भी मिलता हो।
 */
export function suggest(ctx, S, side = 'n') {
  const { DATA } = ctx;
  const isRel = side === 'r';
  const ownQ = isRel ? (S.q2 || '') : (S.q || '');
  const own = parseQuery(ownQ).filter((k) => k.t === 'name');
  if (!own.length) return [];

  const toks = buildTokens(S);
  const namesOf = (r) => [isRel ? r.rn : r.n].filter(Boolean);

  const pool = baseFilter(DATA, S, false);
  const map = new Map();
  let anyStrict = 0;
  for (const r of pool) {
    const { s, mn } = scoreRec(r, toks, false);
    if (s && mn >= 60) { anyStrict++; if (anyStrict >= 10) break; }
  }
  for (const r of pool) {
    const { s, mn } = scoreRec(r, toks, false);
    if (!s) continue;
    if (anyStrict >= 10 && mn < 60) continue;
    for (const nm of namesOf(r)) {
      if (!nm) continue;
      let e = map.get(nm);
      if (!e) { e = { n: nm, s, c: 0, w: new Set(), sr: [] }; map.set(nm, e); }
      e.c++;
      e.sr.push(r.s);
      e.w.add(r.w);
      if (s > e.s) e.s = s;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.s - a.s || b.c - a.c || coll.compare(a.n, b.n))
    .slice(0, 9);
}
