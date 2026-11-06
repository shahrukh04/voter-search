import React from 'react';
import { fmt } from '../lib/format.js';

export default function WardChips({ wards, active, counts, onPick }) {
  let all = 0;
  wards.forEach((w) => { all += counts[w] || 0; });

  return (
    <div className="wards">
      <button className={'wc' + (active === '' ? ' on' : '')} onClick={() => onPick('')}>
        सभी वार्ड<span className="n">{fmt(all)}</span>
      </button>
      {wards.map((w) => (
        <button key={w} className={'wc' + (String(active) === String(w) ? ' on' : '')} onClick={() => onPick(String(w))}>
          वार्ड {w}<span className="n">{fmt(counts[w] || 0)}</span>
        </button>
      ))}
    </div>
  );
}
