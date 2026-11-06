import React from 'react';
import { SORTS } from '../lib/search.js';
import { fmt } from '../lib/format.js';

const AGE_CHIPS = [['18-25', '18–25'], ['26-40', '26–40'], ['41-60', '41–60'], ['60-', '60+'], ['80-', '80+']];

export default function Filters({ S, setS, mohallaOpts, resultCount, open, onClose, onReset }) {
  const set = (patch) => setS((s) => ({ ...s, ...patch }));

  const toggleAge = (a) => {
    const [lo, hi] = a.split('-');
    if (String(S.amin) === lo && String(S.amax) === (hi || '')) set({ amin: '', amax: '' });
    else set({ amin: lo, amax: hi || '' });
  };

  const nFilters =
    ['ward', 'moh', 'g', 'rel', 'h', 'l', 'e'].filter((k) => S[k] !== '').length +
    (S.amin !== '' || S.amax !== '' ? 1 : 0) +
    (S.dup ? 1 : 0) + (S.del ? 1 : 0) + (S.fa ? 1 : 0);

  return (
    <aside className={'panel' + (open ? ' open' : '')}>
      <div className="grab" />
      <div className="phead">
        <h3>🔎 फ़िल्टर {nFilters ? <span className="bdg">{nFilters}</span> : null}</h3>
        <button className="xm mobonly" onClick={onClose} aria-label="बंद करें">✕</button>
      </div>

      <label className="fld">
        मोहल्ला / गली
        <select value={S.moh} onChange={(e) => set({ moh: e.target.value })}>
          <option value="">सभी मोहल्ले</option>
          {mohallaOpts.map(([k, c]) => <option key={k} value={k}>{k} ({c})</option>)}
        </select>
      </label>

      <div className="two">
        <label className="fld">
          लिंग
          <select value={S.g} onChange={(e) => set({ g: e.target.value })}>
            <option value="">सभी</option><option>पुरुष</option><option>स्त्री</option>
          </select>
        </label>
        <label className="fld">
          संबंध
          <select value={S.rel} onChange={(e) => set({ rel: e.target.value })}>
            <option value="">सभी</option><option>पिता</option><option>पति</option><option>माता</option><option>अन्य</option>
          </select>
        </label>
      </div>

      <div className="two">
        <label className="fld">आयु से<input type="number" inputMode="numeric" min="18" max="120" placeholder="18" value={S.amin} onChange={(e) => set({ amin: e.target.value })} /></label>
        <label className="fld">आयु तक<input type="number" inputMode="numeric" min="18" max="120" placeholder="120" value={S.amax} onChange={(e) => set({ amax: e.target.value })} /></label>
      </div>

      <div className="qa">
        {AGE_CHIPS.map(([a, label]) => {
          const [lo, hi] = a.split('-');
          const on = String(S.amin) === lo && String(S.amax) === (hi || '');
          return <button key={a} className={'qc' + (on ? ' on' : '')} onClick={() => toggleAge(a)}>{label}</button>;
        })}
      </div>

      <label className="fld">मकान संख्या<input type="text" inputMode="numeric" placeholder="जैसे 145" value={S.h} onChange={(e) => set({ h: e.target.value })} /></label>

      <div className="two">
        <label className="fld">
          सूची
          <select value={S.l} onChange={(e) => set({ l: e.target.value })}>
            <option value="">सभी</option><option value="orig">मूल सूची</option><option value="sup">पूरक सूची</option>
          </select>
        </label>
        <label className="fld">
          वोटर ID
          <select value={S.e} onChange={(e) => set({ e: e.target.value })}>
            <option value="">सभी</option><option value="yes">ID है</option><option value="no">ID नहीं</option>
          </select>
        </label>
      </div>

      <label className="fld">
        क्रम (Sort)
        <select value={S.sort} onChange={(e) => set({ sort: e.target.value })}>
          {SORTS[S.view].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>

      <label className="chk"><input type="checkbox" checked={S.fa} onChange={(e) => set({ fa: e.target.checked })} /> पिता/पति के नाम में भी खोजें</label>
      <label className="chk"><input type="checkbox" checked={S.dup} onChange={(e) => set({ dup: e.target.checked })} /> सिर्फ़ संभावित दोहराव वाले नाम</label>
      <label className="chk"><input type="checkbox" checked={S.del} onChange={(e) => set({ del: e.target.checked })} /> हटाए गए (विलोपित) नाम भी दिखाएँ</label>

      <button className="btn rst" onClick={onReset}>🔄 सब फ़िल्टर हटाएँ</button>
      <div className="applybar mobonly">
        <button className="btn gold" onClick={onClose}>परिणाम देखें ({fmt(resultCount)}{S.view === 'family' ? ' परिवार' : ''})</button>
      </div>
    </aside>
  );
}
