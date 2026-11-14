import React from 'react';
import { gc, highlightWords, ini } from '../lib/format.js';
import { isSupList } from '../lib/search.js';

export function TagsOf({ r }) {
  return (
    <>
      {r.ed ? <span className="tag sup" title="आपने क्रमांक/वार्ड सुधारा">✎ सुधारा</span> : null}
      {r.d ? <span className="tag red">हटाया गया</span> : null}
      {isSupList(r) ? <span className="tag sup">{r.l}</span> : null}
      {r.dup ? <span className="tag red" title="ID या नाम-पिता-आयु दोबारा मिले">दोहराव?</span> : null}
    </>
  );
}

export default function VoterCard({ r, k, qWords, fa, smode = 'naam', onOpen, voted, voteDisabled, onVote }) {
  // Which line the typed words actually matched — highlight only that one.
  const hlName = smode === 'naam' || smode === 'dono';
  const hlRel = smode === 'pita' || smode === 'dono' || (smode === 'naam' && fa);

  return (
    <article className={'vc' + (r.d ? ' del' : '')} style={{ '--k': Math.min(k, 14) }} onClick={() => onOpen(r.i)}>
      <div className={'av ' + gc(r)}>{ini(r.n)}</div>
      <div className="snb" title="क्रमांक"><small>क्र.</small><b>{r.s}</b></div>
      <div className="vb">
        <div className="nm">
          {hlName ? highlightWords(r.n, qWords) : r.n}
          <TagsOf r={r} />
        </div>
        <div className="rl">
          {r.rel && r.rn ? (
            <>{r.rel}: {hlRel ? highlightWords(r.rn, qWords) : r.rn}</>
          ) : (
            r.rn
          )}
        </div>
        <div className="mt">
          <span className="ch">वार्ड {r.w}</span>
          <span className="ch">{r.a ?? '—'} वर्ष · {r.g === 'पुरुष' ? '♂' : '♀'}</span>
          {r.h ? (
            <span
              className="ch"
              style={{ cursor: 'default' }}
              onClick={(e) => e.stopPropagation()}
            >
              🏠 {r.h}
            </span>
          ) : null}
          {r.m ? <span className="ch">📍 {r.m}</span> : null}
        </div>
        {!r.d && <button type="button" className={'vote-toggle' + (voted ? ' marked' : '')}
          aria-pressed={voted} disabled={voteDisabled} onClick={event => { event.stopPropagation(); onVote(r); }}>
          {voted ? '✓ पर्ची दी गई · टिक हटाएँ' : '□ पर्ची दी गई'}
        </button>}
        {r.e ? <div className="epic">{r.e}</div> : null}
      </div>
    </article>
  );
}
