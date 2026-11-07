import React, { useState } from 'react';
import { copyText, gc, highlightWords, ini, recLine, wa } from '../lib/format.js';
import { MemLi } from './FamilyCard.jsx';

export default function RecordModal({ r, others, qWords, fa, wards, onClose, onOpenRecord, onEditSave, onResetEdit, onShowFamily, canEdit = false, toast }) {
  const [editing, setEditing] = useState(false);
  const [edS, setEdS] = useState(r.s);
  const [edW, setEdW] = useState(r.w);

  const maxWard = Math.max(9, ...wards);
  const wardOpts = [];
  for (let w = 1; w <= maxWard; w++) wardOpts.push(w);

  const kv = [
    ['वार्ड', r.w],
    ['क्रमांक', r.s],
    [(r.rel || 'संबंधी') + ' का नाम', r.rn || '—'],
    ['आयु', (r.a ?? '—') + ' वर्ष'],
    ['लिंग', r.g],
    ['मकान संख्या', r.h || '—'],
    ['मोहल्ला', r.m || '—'],
  ];

  return (
    <div className="modal show" onClick={(e) => { if (e.target.classList.contains('modal')) onClose(); }}>
      <div className="sheet">
        <div className="grab" />
        <div className="mh">
          <div className={'av big ' + gc(r)}>{ini(r.n)}</div>
          <div>
            <h2>{r.n}</h2>
            <div className="sub">वार्ड {r.w} · क्रमांक {r.s} {r.l ? '· ' + r.l : ''}</div>
          </div>
          <button className="xm" onClick={onClose} aria-label="बंद करें">✕</button>
        </div>

        {r.d ? <div className="tag red" style={{ margin: '0 0 10px' }}>यह नाम सूची से हटाया गया है</div> : null}
        {r.dup ? <div className="tag red" style={{ margin: '0 0 10px' }}>संभावित दोहराव — ID या नाम+पिता/पति+आयु दोबारा मिला</div> : null}

        <div className="kv">
          {kv.map(([a, b], k) => (
            <div key={a} style={{ '--k': k }}><small>{a}</small><b>{b}</b></div>
          ))}
          <div className="w" style={{ '--k': 7 }}>
            <small>वोटर ID (EPIC)</small>
            <b>{r.e || <span style={{ color: 'var(--mut)', fontWeight: 500 }}>PDF में नहीं दिया</span>}</b>
          </div>
        </div>

        {canEdit ? (
          <div className={'edf' + (editing ? ' show' : '')}>
            <div className="edr">
              <label>क्रमांक<input inputMode="numeric" value={edS} onChange={(e) => setEdS(e.target.value)} /></label>
              <label>
                वार्ड
                <select value={edW} onChange={(e) => setEdW(e.target.value)}>
                  {wardOpts.map((w) => <option key={w} value={w}>वार्ड {w}</option>)}
                </select>
              </label>
            </div>
            {r.ed ? <small className="orig">मूल: वार्ड {r.w0} · क्रमांक {r.s0}</small> : null}
            <div className="mact">
              <button
                className="btn gold sm"
                onClick={() => {
                  if (!edS.trim()) { toast('क्रमांक खाली नहीं हो सकता'); return; }
                  onEditSave(r.i, +edW, edS.trim());
                  setEditing(false);
                }}
              >✓ सेव करें</button>
              <button className="btn sm" onClick={() => { setEdS(r.s); setEdW(r.w); setEditing(false); }}>रद्द</button>
              {r.ed ? (
                <button className="btn sm" onClick={() => { onResetEdit(r.i); setEditing(false); }}>↺ मूल मान</button>
              ) : null}
            </div>
            <small className="orig">सुधार हर जगह (खोज, परिवार, प्रिंट, CSV) बदल जाएगा।</small>
          </div>
        ) : null}

        <div className="mact">
          {canEdit ? (
            <button className="btn" onClick={() => { setEditing((v) => !v); setEdS(r.s); setEdW(r.w); }}>✏️ क्रमांक / वार्ड सुधारें</button>
          ) : null}
          <button className="btn" onClick={() => copyText(recLine(r)).then(() => toast('✓ कॉपी हो गया'))}>📋 कॉपी</button>
          <button className="btn" onClick={() => wa(recLine(r))}>💬 शेयर</button>
          {others.length ? (
            <button className="btn gold" onClick={() => onShowFamily(r)}>🏠 पूरा परिवार ({others.length + 1})</button>
          ) : null}
        </div>

        {others.length ? (
          <div className="fam">
            <h4>इसी मकान के अन्य सदस्य ({others.length})</h4>
            <ul className="mem">
              {others.map((m) => (
                <li key={m.i} data-i={m.i} onClick={() => onOpenRecord(m.i)} style={{ display: 'flex' }}>
                  <MemLi m={m} hit={false} qWords={qWords} x={false} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
