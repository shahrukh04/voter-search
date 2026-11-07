/**
 * Hindi / Roman fuzzy text normalisation.
 * Ported 1:1 from the legacy HTML app so search behaviour stays identical
 * (matra-insensitive, nukta-insensitive, Roman input support).
 */

const IND = { आ: 'अ', इ: 'इ', ई: 'इ', उ: 'उ', ऊ: 'उ', ए: 'ए', ऐ: 'ए', ओ: 'ओ', औ: 'ओ', ऑ: 'ओ', ऍ: 'ए', ऎ: 'ए', ऒ: 'ओ', ऋ: 'र', ॠ: 'र' };
const FOLD = { ख: 'क', घ: 'ग', छ: 'च', झ: 'ज', ठ: 'त', ढ: 'द', थ: 'त', ध: 'द', फ: 'प', भ: 'ब', ट: 'त', ड: 'द', श: 'स', ष: 'स', ण: 'न', ङ: 'न', ञ: 'न', व: 'ब', ळ: 'ल', ऱ: 'र' };
export const DEVD = '०१२३४५६७८९';

export function toAscii(s) {
  return (s || '').replace(/[०-९]/g, (c) => DEVD.indexOf(c));
}

function devSkel(w) {
  w = w.normalize('NFD').replace(/़/g, '');
  w = w.replace(/[नमणङञ]्(?=[क-ह])/g, '');
  let o = '';
  for (const ch of w) {
    const c = ch.codePointAt(0);
    if (c >= 0x0900 && c <= 0x0903) continue; // ँ ं ः
    if (c === 0x093c || c === 0x094d) continue; // nukta, virama
    if (c >= 0x093a && c <= 0x094f) continue; // all vowel signs
    if (c >= 0x0951 && c <= 0x0957) continue;
    if (c === 0x0962 || c === 0x0963) continue;
    if (c >= 0x0966 && c <= 0x096f) { o += String(c - 0x0966); continue; }
    o += IND[ch] || FOLD[ch] || ch;
  }
  return o.replace(/(.)\1+/g, '$1');
}

function romanSkel(w) {
  w = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  let o = '';
  let i = 0;
  let start = true;
  const isV = (c) => 'aeiou'.indexOf(c) >= 0;
  while (i < w.length) {
    const c = w[i];
    const n2 = w.substr(i, 2);
    const n3 = w.substr(i, 3);
    if (/[0-9]/.test(c)) { o += c; i++; start = false; continue; }
    if (isV(c)) {
      if (start) o += { a: 'अ', i: 'इ', u: 'उ', e: 'ए', o: 'ओ' }[c];
      while (i < w.length && isV(w[i])) i++;
      start = false;
      continue;
    }
    start = false;
    if (n3 === 'ksh') { o += 'कस'; i += 3; continue; }
    if (n3 === 'chh') { o += 'च'; i += 3; continue; }
    if (n3 === 'shh') { o += 'स'; i += 3; continue; }
    // ज्ञ के रोमन रूप — gyan / gnan / jnan सब ज्ञान पर जाएँ (skeleton "जन")
    if (n2 === 'gy' || n2 === 'gn' || n2 === 'jn') { o += 'जन'; i += 2; continue; }
    const di = { ch: 'च', sh: 'स', kh: 'क', gh: 'ग', jh: 'ज', th: 'त', dh: 'द', ph: 'प', bh: 'ब' }[n2];
    if (di) { o += di; i += 2; continue; }
    if (c === 'n' || c === 'm') {
      const nx = w[i + 1];
      if (nx && !isV(nx) && nx !== 'h' && nx !== 'y' && nx !== c && !/[0-9]/.test(nx)) { i++; continue; }
      o += c === 'n' ? 'न' : 'म';
      i++;
      continue;
    }
    const mp = { k: 'क', c: 'क', q: 'क', g: 'ग', j: 'ज', z: 'ज', t: 'त', d: 'द', p: 'प', f: 'प', b: 'ब', v: 'ब', w: 'ब', y: 'य', r: 'र', l: 'ल', s: 'स', h: 'ह', x: 'कस' };
    o += mp[c] || '';
    i++;
  }
  return o.replace(/(.)\1+/g, '$1');
}

export const rawN = (s) => (s || '').normalize('NFD').replace(/\u093C/g, '').normalize('NFC').toLowerCase();

export const ALIAS = { mohd: 'मोहम्मद', md: 'मोहम्मद', mohammad: 'मोहम्मद', mohammed: 'मोहम्मद', muhammad: 'मोहम्मद', mohamad: 'मोहम्मद', smt: '', shri: '' };

const wcache = new Map();
export function skelWord(w) {
  let r = wcache.get(w);
  if (r !== undefined) return r;
  r = /[A-Za-z]/.test(w) ? romanSkel(w) : devSkel(w);
  wcache.set(w, r);
  return r;
}
export const skelWords = (s) => (s || '').split(/[\s,.\-/]+/).filter(Boolean).map(skelWord).filter(Boolean);

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 9;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}

export function wordScore(q, w) {
  if (w === q) return 130;
  if (w.startsWith(q)) return 110 - Math.min(30, w.length - q.length);
  if (q.length >= 2 && w.includes(q)) return 60;
  if (q.length >= 4 && q[0] === w[0]) {
    const lim = q.length >= 7 ? 2 : 1;
    const d = Math.min(lev(q, w), lev(q, w.slice(0, q.length)));
    if (d <= lim) return 35 - d * 5;
  }
  return 0;
}

export function bestScore(q, words) {
  let b = 0;
  for (const w of words) {
    const s = wordScore(q, w);
    if (s > b) b = s;
  }
  // नाम कई शब्दों में लिखा हो ("ज्ञान चंद") पर user एक शब्द में खोजे ("ज्ञानचन्द"),
  // तो पूरे नाम को जोड़कर भी मिलान करें।
  if (words.length > 1) {
    const s = wordScore(q, words.join(''));
    if (s > b) b = s;
  }
  return b;
}
