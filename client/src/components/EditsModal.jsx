import React, { useRef } from 'react';
import { downloadFile } from '../lib/format.js';

export default function EditsModal({ edits, byId, onClose, onRestore, onClearAll, toast }) {
  const fileRef = useRef(null);
  const ids = Object.keys(edits).map(Number).filter((i) => byId(i));

  const backup = () => {
    downloadFile('jaliya_sudhar_backup.json', JSON.stringify({ v: 1, edits }), 'application/json');
    toast('✓ बैकअप डाउनलोड हुआ');
  };

  const onFile = (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        onRestore(JSON.parse(rd.result).edits || {});
      } catch (e) {
        toast('⚠ यह सही बैकअप फ़ाइल नहीं है');
      }
    };
    rd.readAsText(f);
    ev.target.value = '';
  };

  return (
    <div className="modal show" onClick={(e) => { if (e.target.classList.contains('modal')) onClose(); }}>
      <div className="sheet">
        <div className="grab" />
        <div className="mh">
          <div className="av big m">✎</div>
          <div>
            <h2>मेरे सुधार</h2>
            <div className="sub">{ids.length} रिकॉर्ड सुधारे गए · सर्वर पर सेव</div>
          </div>
          <button className="xm" onClick={onClose} aria-label="बंद करें">✕</button>
        </div>

        <div className="note" style={{ margin: '0 0 12px' }}>
          किसी भी नाम पर टैप करके "✏️ क्रमांक / वार्ड सुधारें" दबाएँ। सुधार सभी उपयोगकर्ताओं को दिखते हैं।
        </div>

        <ul className="mem">
          {ids.length ? ids.map((i) => {
            const r = byId(i);
            return (
              <li key={i} style={{ display: 'flex', cursor: 'default' }}>
                <span className="msn">{r.s}</span>
                <span className="mi">
                  <b>{r.n}</b>
                  <small>मूल: वार्ड {r.w0} · क्र. {r.s0} → अब: वार्ड {r.w} · क्र. {r.s}</small>
                </span>
              </li>
            );
          }) : <li style={{ cursor: 'default' }}><span className="mi"><small>अभी कोई सुधार नहीं।</small></span></li>}
        </ul>

        <div className="mact" style={{ marginTop: 14 }}>
          <button className="btn gold" onClick={backup}>💾 बैकअप डाउनलोड</button>
          <button className="btn" onClick={() => fileRef.current && fileRef.current.click()}>📂 बैकअप से वापस लाएँ</button>
          {ids.length ? <button className="btn" onClick={onClearAll}>↺ सब सुधार हटाएँ</button> : null}
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onFile} />
        </div>
      </div>
    </div>
  );
}
