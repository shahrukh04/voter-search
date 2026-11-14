import React from 'react';

export function ListFormat({ value, onChange }) {
  return <label className="format-select">फ़ॉर्मेट <select value={value} onChange={e => onChange(e.target.value)}>
    <option value="cards">कार्ड</option><option value="rows">पंक्तियाँ</option>
  </select></label>;
}

export function VoterRows({ records, action, onOpen }) {
  return <div className="report-scroll"><table className="voter-rows">
    <thead><tr><th>वार्ड</th><th>क्रमांक</th><th>नाम</th><th>पिता / पति</th><th>मकान</th><th>मतदाता ID</th>{action && <th className="screen-action">कार्य</th>}</tr></thead>
    <tbody>{records.map(r => <tr key={r.i}><td>{r.w}</td><td>{r.s}</td>
      <td>{onOpen ? <button className="row-name" onClick={() => onOpen(r.i)}>{r.n}</button> : r.n}</td>
      <td>{r.rn || '—'}</td><td>{r.h || '—'}</td><td>{r.e || '—'}</td>
      {action && <td className="screen-action">{action(r)}</td>}</tr>)}</tbody>
  </table></div>;
}
