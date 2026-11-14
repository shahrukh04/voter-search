import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

export default function VoteReport({ records, user, owner, setOwner, marks, pending, onRemove, onClose, error, retry }) {
  const [accounts, setAccounts] = useState([]);
  const [accountError, setAccountError] = useState(false);
  const [ward, setWard] = useState('');
  const [query, setQuery] = useState('');
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
    let total = 0;
    for (const r of records) {
      if (r.d) continue;
      total++;
      const key = String(r.w ?? '—');
      const row = byWard.get(key) || { ward: key, total: 0, voted: 0 };
      row.total++;
      if (marks?.has(r.i)) { row.voted++; marked.push(r); }
      byWard.set(key, row);
    }
    return { total, marked, wards: [...byWard.values()].sort((a,b) => Number(a.ward)-Number(b.ward)) };
  }, [records, marks]);

  const matches = tally.marked.filter(r =>
    (!ward || String(r.w ?? '—') === ward) &&
    [r.n, r.e, r.s].some(value => String(value ?? '').toLowerCase().includes(query.trim().toLowerCase()))
  );
  const current = Math.min(page, Math.max(0, Math.ceil(matches.length / 30) - 1));
  return <main className="wrap vote-report">
    <header><h1>मतदान रिपोर्ट</h1><button className="btn" onClick={onClose}>← मतदाता सूची</button></header>
    {user.superAdmin ? <label className="fld">खाते की रिपोर्ट
      <select value={owner} disabled={pending} onChange={e => { setOwner(e.target.value); setPage(0); }}>
        {!accounts.length && <option value={user.id}>{user.name} · {user.username}</option>}
        {accounts.map(a => <option value={a._id} key={a._id}>{a.name} · {a.username}</option>)}
      </select></label> : <p>{user.name} · {user.username}</p>}
    {accountError && <p role="alert">खातों की सूची लोड नहीं हुई। रिपोर्ट दोबारा खोलें।</p>}
    {!marks ? <p role="status">{error ? <>मतदान डेटा लोड नहीं हुआ। <button className="btn" onClick={retry}>फिर कोशिश करें</button></> : 'मतदान डेटा लोड हो रहा है…'}</p> : <>
      <div className="adm-metrics"><div><span>कुल मतदाता</span><strong>{tally.total}</strong></div><div><span>वोट दिया दर्ज</span><strong>{tally.marked.length}</strong></div></div>
      <h2>वार्डवार गिनती</h2>
      <table><thead><tr><th>वार्ड</th><th>कुल मतदाता</th><th>वोट दिया दर्ज</th></tr></thead>
        <tbody>{tally.wards.map(w => <tr key={w.ward}><th>{w.ward}</th><td>{w.total}</td><td>{w.voted}</td></tr>)}</tbody></table>
      <h2>वोट दिया दर्ज सूची</h2>
      <div className="two"><label className="fld">वार्ड<select value={ward} onChange={e => { setWard(e.target.value); setPage(0); }}>
        <option value="">सभी वार्ड</option>{tally.wards.map(w => <option key={w.ward}>{w.ward}</option>)}</select></label>
        <label className="fld">नाम, मतदाता आईडी या क्रमांक<input type="text" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label></div>
      <p>{matches.length} परिणाम</p>
      {matches.slice(current*30, current*30+30).map(r => <article key={r.i} className="vote-entry">
        <div><strong>{r.n}</strong><small>वार्ड {r.w} · क्रमांक {r.s}{r.e ? ' · '+r.e : ''}</small></div>
        {user.superAdmin && <button className="btn sm" disabled={pending} onClick={() => onRemove(r)}>टिक हटाएँ</button>}
      </article>)}
      {matches.length>30 && <div className="pager"><button className="btn" disabled={!current} onClick={()=>setPage(current-1)}>पिछला</button>
        <span>{current+1} / {Math.ceil(matches.length/30)}</span><button className="btn" disabled={(current+1)*30>=matches.length} onClick={()=>setPage(current+1)}>अगला</button></div>}
    </>}
  </main>;
}
