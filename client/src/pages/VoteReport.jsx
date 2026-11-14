import React, { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { ListFormat, VoterRows } from '../components/ListFormat.jsx';
import DistributionCharts from '../components/DistributionCharts.jsx';
import { bestScore, toAscii } from '../lib/hindi.js';
import { parseQuery } from '../lib/search.js';
import { downloadCSV } from '../lib/format.js';
import { api } from '../lib/api.js';

export default function VoteReport({ records, user, owner, setOwner, marks, pending, onRemove, onClose, error, retry }) {
  const [accounts, setAccounts] = useState([]);
  const [accountError, setAccountError] = useState(false);
  const [status, setStatus] = useState('marked');
  const [ward, setWard] = useState('');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('rows');
  const [printing, setPrinting] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!user.superAdmin) return;
    let alive = true;
    api.voteAccounts().then(r => { if (alive) setAccounts(r.accounts); })
      .catch(() => { if (alive) setAccountError(true); });
    return () => { alive = false; };
  }, [user.superAdmin]);

  const tally = useMemo(() => {
    const byWard = new Map();
    const marked = [];
    const unmarked = [];
    let total = 0;
    for (const r of records) {
      if (r.d) continue;
      total++;
      const key = String(r.w ?? '—');
      const row = byWard.get(key) || { ward: key, total: 0, voted: 0, areas: new Map() };
      row.total++;
      const areaKey = r.m || 'अनिर्दिष्ट';
      const area = row.areas.get(areaKey) || { total: 0, voted: 0 };
      area.total++;
      if (marks?.has(r.i)) area.voted++;
      row.areas.set(areaKey, area);
      if (marks?.has(r.i)) { row.voted++; marked.push(r); }
      else unmarked.push(r);
      byWard.set(key, row);
    }
    return { total, marked, unmarked, wards: [...byWard.values()].sort((a,b) => Number(a.ward)-Number(b.ward)) };
  }, [records, marks]);

  const percent = (voted, total) => total ? (100 * voted / total).toLocaleString('hi-IN', { maximumFractionDigits: 1 }) + '%' : '—';
  const tokens = parseQuery(query);
  const matches = (status === 'marked' ? tally.marked : tally.unmarked).filter(r =>
    (!ward || String(r.w ?? '—') === ward) &&
    (tokens.every(token => token.t === 'name'
      ? bestScore(token.v, r.nw) > 0
      : token.t === 'house' ? toAscii(String(r.s)).includes(token.v)
        : String(r.e || '').toLowerCase().replace(/[^a-z0-9]/g,'').includes(token.v))
      || [r.n, r.e, r.s].some(v => String(v ?? '').toLowerCase().includes(query.trim().toLowerCase())))
  );
  const current = Math.min(page, Math.max(0, Math.ceil(matches.length / 30) - 1));
  const shown = printing ? matches : matches.slice(current*30,current*30+30);
  const account = accounts.find(a => a._id === owner)?.username || (owner === user.id ? user.username : owner);
  const statusLabel = status === 'marked' ? 'पर्ची दी गई' : 'पर्ची देना बाकी';
  function exportReport() {
    const rows = [
      ['पर्ची वितरण रिपोर्ट',account], ['कुल मतदाता','दी गई','बाकी','वितरण प्रतिशत'],
      [tally.total,tally.marked.length,tally.unmarked.length,percent(tally.marked.length,tally.total)], [],
      ['वार्ड','कुल मतदाता','दी गई','बाकी','वितरण प्रतिशत'],
      ...tally.wards.map(w=>[w.ward,w.total,w.voted,w.total-w.voted,percent(w.voted,w.total)]), [],
      ['स्थिति',statusLabel,'वार्ड',ward || 'सभी','खोज',query,'परिणाम',matches.length],
      ['वार्ड','क्रमांक','नाम','पिता / पति','मकान','मतदाता ID','स्थिति'],
      ...matches.map(r=>[r.w,r.s,r.n,r.rn,r.h,r.e,statusLabel])
    ];
    const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, first => "'" + first).replace(/"/g,'""') + '"';
    downloadCSV('parchi-report-'+account+'.csv',rows.map(row=>row.map(cell).join(',')).join('\r\n'));
  }
  function printReport() {
    flushSync(() => setPrinting(true));
    try { window.print(); } finally { setPrinting(false); }
  }
  return <main className="wrap vote-report">
    <header><h1>पर्ची वितरण रिपोर्ट</h1><button className="btn" onClick={onClose}>← मतदाता सूची</button></header>
    {user.superAdmin ? <label className="fld">खाते की रिपोर्ट
      <select value={owner} disabled={pending} onChange={e => { setOwner(e.target.value); setPage(0); }}>
        {!accounts.length && <option value={user.id}>{user.name} · {user.username}</option>}
        {accounts.map(a => <option value={a._id} key={a._id}>{a.name} · {a.username}</option>)}
      </select></label> : <p>{user.name} · {user.username}</p>}
    {accountError && <p role="alert">खातों की सूची लोड नहीं हुई। रिपोर्ट दोबारा खोलें।</p>}
    {!marks ? <p role="status">{error ? <>पर्ची वितरण का डेटा लोड नहीं हुआ। <button className="btn" onClick={retry}>फिर कोशिश करें</button></> : 'पर्ची वितरण का डेटा लोड हो रहा है…'}</p> : <>
      <div className="adm-metrics"><div><span>कुल मतदाता</span><strong>{tally.total}</strong></div><div><span>पर्ची दी गई</span><strong>{tally.marked.length}</strong></div><div><span>पर्ची देना बाकी</span><strong>{tally.unmarked.length}</strong></div><div><span>वितरण प्रतिशत</span><strong>{percent(tally.marked.length,tally.total)}</strong></div></div>
      <DistributionCharts tally={tally} />
      <h2>वार्डवार गिनती</h2>
      <table><thead><tr><th>वार्ड</th><th>कुल मतदाता</th><th>पर्ची दी गई</th><th>बाकी</th><th>वितरण %</th></tr></thead>
        <tbody>{tally.wards.map(w => <tr key={w.ward}><th>{w.ward}</th><td>{w.total}</td><td>{w.voted}</td><td>{w.total-w.voted}</td><td>{percent(w.voted,w.total)}</td></tr>)}</tbody></table>
      <h2>मतदाता विवरण</h2>
      <label className="fld">सूची चुनें<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
        <option value="marked">पर्ची दी गई</option><option value="unmarked">पर्ची देना बाकी</option>
      </select></label>
      <div className="two"><label className="fld">वार्ड<select value={ward} onChange={e => { setWard(e.target.value); setPage(0); }}>
        <option value="">सभी वार्ड</option>{tally.wards.map(w => <option key={w.ward}>{w.ward}</option>)}</select></label>
        <label className="fld">नाम, मतदाता आईडी या क्रमांक<input type="text" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label></div>
      <div className="report-tools"><span>{matches.length} परिणाम</span><ListFormat value={format} onChange={setFormat} />
        <button className="btn sm" onClick={exportReport}>CSV डाउनलोड</button><button className="btn pri sm" onClick={printReport}>PDF / प्रिंट</button></div>
      <p className="print-caption">{account} · {statusLabel} · वार्ड {ward || 'सभी'} · {query || 'सभी नाम'} · {matches.length} परिणाम</p>
      {format === 'rows' ? <VoterRows records={shown} action={status === 'marked' ? r => <button className="btn sm" disabled={pending} onClick={() => onRemove(r)}>टिक हटाएँ</button> : null} /> :
        <div className="report-cards">{shown.map(r => <article key={r.i} className="vote-entry">
        <div><strong>{r.n}</strong><small>वार्ड {r.w} · क्रमांक {r.s}{r.e ? ' · '+r.e : ''}</small></div>
        {status === 'marked' && <button className="btn sm" disabled={pending} onClick={() => onRemove(r)}>टिक हटाएँ</button>}
      </article>)}</div>}
      {matches.length>30 && <div className="pager"><button className="btn" disabled={!current} onClick={()=>setPage(current-1)}>पिछला</button>
        <span>{current+1} / {Math.ceil(matches.length/30)}</span><button className="btn" disabled={(current+1)*30>=matches.length} onClick={()=>setPage(current+1)}>अगला</button></div>}
    </>}
  </main>;
}
