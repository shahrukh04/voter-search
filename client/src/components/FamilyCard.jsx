import React, { useState } from 'react';
import { gc, highlightWords, ini, famText, copyText, wa } from '../lib/format.js';

export function MemLi({ m, hit, qWords, x }) {
  return (
    <li className={(hit ? 'hit' : '') + (x ? ' x' : '')} data-i={m.i}>
      <span className={'mav ' + gc(m)}>{ini(m.n)}</span>
      <span className="msn" title="क्रमांक">{m.s}</span>
      <span className="mi">
        <b>{hit ? highlightWords(m.n, qWords) : m.n}</b>
        <small>{m.rel}{m.rn ? ': ' + m.rn : ''}</small>
      </span>
      <span className="ma">{m.a ?? '—'}<small>{m.g}</small></span>
    </li>
  );
}

const LIM = 5;

export default function FamilyCard({ f, k, MATCH, qWords, onOpenRecord, onMembers, toast }) {
  const [open, setOpen] = useState(false);

  return (
    <article className={'fc' + (open ? ' open' : '')} style={{ '--k': Math.min(k, 12) }}>
      <div className="fh">
        <div className={'hb' + (String(f.h).length > 5 ? ' long' : '')}>
          <small>मकान</small><b>{f.h}</b>
        </div>
        <div className="fi">
          <div className="ft">परिवार · {f.n} सदस्य</div>
          <div className="fs">वार्ड {f.w}{f.m ? ' · ' + f.m : ''}</div>
          <div className="pl">
            <span className="ch">♂ {f.male}</span>
            <span className="ch">♀ {f.fem}</span>
            <span className="ch">औसत {f.avg} वर्ष</span>
            {f.sen ? <span className="ch">60+: {f.sen}</span> : null}
            {f.n >= 12 ? <span className="ch" title="एक मकान नंबर पर कई परिवार हो सकते हैं">बड़ा समूह</span> : null}
          </div>
        </div>
      </div>
      <ul className="mem" onClick={(e) => { const li = e.target.closest('li[data-i]'); if (li) onOpenRecord(+li.dataset.i); }}>
        {f.mem.map((m, i) => (
          <MemLi key={m.i} m={m} hit={MATCH && MATCH.has(m.i)} qWords={qWords} x={i >= LIM} />
        ))}
      </ul>
      {f.n > LIM ? (
        <button className="expand" onClick={() => setOpen((o) => !o)}>
          {open ? 'कम दिखाएँ ' : `सभी ${f.n} सदस्य `}<i>⌄</i>
        </button>
      ) : null}
      <div className="fa">
        <button className="btn sm" onClick={() => copyText(famText(f)).then(() => toast('✓ कॉपी हो गया'))}>📋 कॉपी</button>
        <button className="btn sm" onClick={() => wa(famText(f))}>💬 शेयर</button>
        <button className="btn sm gold" onClick={() => onMembers(f)}>🗳 मतदाता सूची</button>
      </div>
    </article>
  );
}
