import React from 'react';
import { fmt } from '../lib/format.js';
import { houseKey, validH } from '../lib/search.js';

export default function Stats({ view, RES }) {
  let items;
  if (view === 'voters') {
    const n = RES.length;
    const m = RES.filter((r) => r.g === 'पुरुष').length;
    const f = RES.filter((r) => r.g === 'स्त्री').length;
    const ages = RES.map((r) => r.a).filter((a) => a !== null);
    const avg = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const y = RES.filter((r) => r.a !== null && r.a <= 25).length;
    const o = RES.filter((r) => r.a >= 60).length;
    const hs = new Set(RES.filter((r) => validH(r)).map(houseKey)).size;
    items = [[n, 'कुल मतदाता'], [m, 'पुरुष'], [f, 'स्त्री'], [avg, 'औसत आयु'], [y, '18–25 वर्ष'], [o, '60+ वर्ष'], [hs, 'अलग मकान']];
  } else {
    const n = RES.length;
    const tot = RES.reduce((a, f) => a + f.n, 0);
    const mx = RES.reduce((a, f) => Math.max(a, f.n), 0);
    const m = RES.reduce((a, f) => a + f.male, 0);
    const fe = RES.reduce((a, f) => a + f.fem, 0);
    items = [[n, 'परिवार / मकान'], [tot, 'कुल सदस्य'], [n ? Math.round((tot / n) * 10) / 10 : 0, 'औसत सदस्य'], [mx, 'सबसे बड़ा समूह'], [m, 'पुरुष'], [fe, 'स्त्री']];
  }

  return (
    <div className="stats">
      {items.map(([val, label], i) => (
        <div className="stat" style={{ '--k': i }} key={label}>
          <b>{typeof val === 'number' ? val.toLocaleString('en-IN') : val}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
