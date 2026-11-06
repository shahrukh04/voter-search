import React from 'react';
import { skelWord, wordScore } from './hindi.js';

export const fmt = (n) => Number(n).toLocaleString('en-IN');
export const ini = (n) => Array.from((n || '?').trim())[0] || '?';
export const gc = (r) => (r.g === 'पुरुष' ? 'm' : 'f');

/** Highlight query words inside a name (returns React nodes). */
export function highlightWords(text, qWords) {
  const s = String(text ?? '');
  if (!qWords || !qWords.length) return s;
  const parts = s.split(/(\s+)/);
  return parts.map((p, idx) => {
    if (!p.trim()) return p;
    const sk = skelWord(p);
    if (sk && qWords.some((q) => wordScore(q, sk) > 0)) {
      return React.createElement('mark', { key: idx }, p);
    }
    return p;
  });
}

export function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(t);
  }
  const a = document.createElement('textarea');
  a.value = t;
  a.style.position = 'fixed';
  a.style.opacity = '0';
  document.body.appendChild(a);
  a.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  a.remove();
  return Promise.resolve();
}

export const wa = (t) => window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');

export const recLine = (r) =>
  `क्र. ${r.s} | ${r.n} | ${r.rel}: ${r.rn} | आयु ${r.a} | ${r.g} | वार्ड ${r.w} | मकान ${r.h} | ${r.m} | ${r.e}`;

export const famText = (f) =>
  `🏠 मकान ${f.h} · वार्ड ${f.w}${f.m ? ' · ' + f.m : ''}\nकुल सदस्य: ${f.n}\n` +
  f.mem.map((m) => `क्र. ${m.s} · ${m.n} (${m.rel}: ${m.rn}) · ${m.a ?? '—'} वर्ष · ${m.g}`).join('\n');

export function downloadCSV(name, text) {
  const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadFile(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportCSV(S, RES) {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const tag = (S.ward ? 'ward' + S.ward : 'all') + '_' + RES.length;
  if (S.view === 'voters') {
    const head = ['वार्ड', 'क्रमांक', 'नाम', 'संबंध', 'पिता/पति का नाम', 'आयु', 'लिंग', 'मकान', 'मोहल्ला', 'वोटर ID', 'सूची', 'स्थिति', 'क्रमांक/वार्ड सुधारा'];
    const rows = RES.map((r) => [r.w, r.s, r.n, r.rel, r.rn, r.a, r.g, r.h, r.m, r.e, r.l, r.d ? 'हटाया गया' : '', r.ed ? 'हाँ' : ''].map(q).join(','));
    downloadCSV('jaliya_voters_' + tag + '.csv', head.map(q).join(',') + '\n' + rows.join('\n'));
  } else {
    const head = ['वार्ड', 'मकान', 'मोहल्ला', 'सदस्य', 'पुरुष', 'स्त्री', 'औसत आयु', 'सदस्यों के क्रमांक', 'सदस्यों के नाम'];
    const rows = RES.map((f) => [f.w, f.h, f.m, f.n, f.male, f.fem, f.avg, f.mem.map((m) => m.s).join('; '), f.mem.map((m) => m.n + ' (' + (m.a ?? '') + ')').join('; ')].map(q).join(','));
    downloadCSV('jaliya_families_' + tag + '.csv', head.map(q).join(',') + '\n' + rows.join('\n'));
  }
}
