import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PLAN_DEFAULT = '₹5,000 / माह';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function inOneMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toDateInput(d);
}

function StatusTag({ status }) {
  if (status === 'approved') return <span className="tag sup">स्वीकृत</span>;
  if (status === 'rejected') return <span className="tag red">अस्वीकृत</span>;
  return <span className="tag">पेंडिंग</span>;
}

export default function AdminPanel({ onClose }) {
  const { user, logout } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('requests');
  const [reqs, setReqs] = useState(null);
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [form, setForm] = useState({
    name: '', username: '', password: '', role: 'user', expiresAt: inOneMonth(),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadRequests = useCallback(async () => {
    try {
      const r = await api.adminRequests();
      setReqs(r.items || []);
      setErr('');
    } catch (e) { setErr('अनुरोध लोड नहीं हो सके'); }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const r = await api.adminUsers();
      setUsers(r.users || []);
      setErr('');
    } catch (e) { setErr('उपयोगकर्ता लोड नहीं हो सके'); }
  }, []);

  useEffect(() => { loadRequests(); loadUsers(); }, [loadRequests, loadUsers]);

  const pending = useMemo(() => (reqs || []).filter((r) => r.status === 'pending').length, [reqs]);

  /* ---------- subscription requests ---------- */
  async function setReqStatus(id, status) {
    setBusyId(id);
    try {
      const res = await api.adminUpdateRequest(id, status);
      const req = res.request || null;
      setReqs((list) => (list || []).map((x) => (x._id === id ? req || { ...x, status } : x)));

      if (status === 'approved') {
        if (res.user) {
          sendCredentials(req || {}, res.user);
          toast('✓ स्वीकृत — यूज़र बन गया, WhatsApp खुल रहा है');
          loadUsers();
        } else {
          toast('⚠ स्वीकृत, पर पासवर्ड नहीं था — यूज़र नहीं बना');
        }
      } else {
        toast(status === 'rejected' ? '✕ अस्वीकृत' : '↺ पेंडिंग');
      }
    } catch (e) {
      toast('⚠ अपडेट नहीं हुआ');
    } finally {
      setBusyId('');
    }
  }

  function waLink(mobile, text) {
    const to = String(mobile || '').replace(/\D/g, '');
    window.open('https://wa.me/91' + to + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  // Sent to the applicant as soon as the admin approves their request.
  function sendCredentials(req, u) {
    const text =
      'नमस्ते,\n' +
      'जालिया मतदाता ऐप — आपका सब्सक्रिप्शन स्वीकृत हो गया ✅\n\n' +
      'लॉगिन आईडी: ' + u.username + '\n' +
      'पासवर्ड: ' + (req.password || '') + '\n\n' +
      'ऐप खोलकर इन्हीं से लॉगिन करें।';
    waLink(req.mobile, text);
  }

  function whatsapp(r) {
    const text =
      'नमस्ते,\n' +
      'जालिया मतदाता ऐप सब्सक्रिप्शन —\n' +
      'लॉगिन आईडी: ' + r.loginId + '\n' +
      (r.password ? 'पासवर्ड: ' + r.password + '\n' : '') +
      'प्लान: ' + (r.plan || PLAN_DEFAULT) + '\n';
    waLink(r.mobile, text);
  }

  function prefillUser(r) {
    setForm((f) => ({ ...f, name: r.name, username: r.loginId, password: '', role: 'user', expiresAt: inOneMonth() }));
    setTab('users');
    toast('नीचे फॉर्म में भर दिया — पासवर्ड डालकर सेव करें');
  }

  /* ---------- users ---------- */
  async function toggleActive(u) {
    if (u.username === (user && user.username)) { toast('⚠ खुद को निष्क्रिय नहीं कर सकते'); return; }
    setBusyId(u.id);
    try {
      const r = await api.adminUpdateUser(u.id, { active: !u.active });
      setUsers((list) => (list || []).map((x) => (x.id === u.id ? r.user : x)));
      toast(!u.active ? '▶️ सक्रिय कर दिया' : '⏸ निष्क्रिय कर दिया');
    } catch (e) {
      toast('⚠ अपडेट नहीं हुआ');
    } finally {
      setBusyId('');
    }
  }

  async function changeRole(u) {
    const next = u.role === 'admin' ? 'user' : 'admin';
    if (u.username === (user && user.username)) { toast('⚠ अपनी ही भूमिका नहीं बदल सकते'); return; }
    setBusyId(u.id);
    try {
      const r = await api.adminUpdateUser(u.id, { role: next });
      setUsers((list) => (list || []).map((x) => (x.id === u.id ? r.user : x)));
      toast(next === 'admin' ? '🛡 एडमिन बना दिया' : '👤 यूज़र बना दिया');
    } catch (e) {
      toast('⚠ भूमिका नहीं बदली');
    } finally {
      setBusyId('');
    }
  }

  async function saveExpiry(u) {
    if (!editDate) { toast('तारीख चुनें'); return; }
    setBusyId(u.id);
    try {
      const r = await api.adminUpdateUser(u.id, { expiresAt: new Date(editDate + 'T23:59:59').toISOString() });
      setUsers((list) => (list || []).map((x) => (x.id === u.id ? r.user : x)));
      setEditing(null);
      toast('✓ समाप्ति तिथि सेव हुई');
    } catch (e) {
      toast('⚠ तारीख सेव नहीं हुई');
    } finally {
      setBusyId('');
    }
  }

  async function createUser(e) {
    e.preventDefault();
    const { name, username, password, role, expiresAt } = form;
    if (!name.trim() || !username.trim() || !expiresAt) { toast('नाम, आईडी और तारीख भरें'); return; }
    if (password && password.length < 4) { toast('पासवर्ड कम से कम 4 अक्षर'); return; }
    const exists = (users || []).some((u) => u.username === username.trim().toLowerCase());
    if (!exists && !password) { toast('नए यूज़र के लिए पासवर्ड ज़रूरी है'); return; }
    try {
      const r = await api.adminUpsertUser({
        name: name.trim(),
        username: username.trim(),
        password: password || undefined,
        role,
        expiresAt: new Date(expiresAt + 'T23:59:59').toISOString(),
      });
      setUsers((list) => {
        const rest = (list || []).filter((x) => x.id !== r.user.id);
        return [r.user, ...rest];
      });
      setForm({ name: '', username: '', password: '', role: 'user', expiresAt: inOneMonth() });
      toast('✓ यूज़र सेव हो गया');
    } catch (ex) {
      toast('⚠ सेव नहीं हो सका');
    }
  }

  return (
    <div className="adm">
      <header className="adm-hero">
        <div className="wrap adm-hero-in">
          <div>
            <div className="adm-own">एडमिन पैनल</div>
            <div className="adm-sub">{user ? user.name + ' · ' + user.username : ''}</div>
          </div>
          <div className="adm-hbtns">
            <button className="icon-btn" onClick={onClose} title="ऐप पर वापस" aria-label="ऐप पर वापस">←</button>
            <button className="icon-btn" onClick={logout} title="लॉग आउट" aria-label="लॉग आउट">⎋</button>
          </div>
        </div>
      </header>

      <main>
        <div className="wrap">
          <div className="segbar">
            <button className={'adm-tab' + (tab === 'requests' ? ' on' : '')} onClick={() => setTab('requests')}>
              🔔 अनुरोध{pending ? <i className="badge">{pending}</i> : null}
            </button>
            <button className={'adm-tab' + (tab === 'users' ? ' on' : '')} onClick={() => setTab('users')}>
              👤 उपयोगकर्ता
            </button>
          </div>

          {err ? <div className="note" style={{ color: '#c0392b' }}>{err}</div> : null}

          {tab === 'requests' ? (
            <>
            <div className="note">✅ "स्वीकृत" करते ही यूज़र अपने-आप बन जाता है और उसके WhatsApp पर लॉगिन आईडी/पासवर्ड भेजने का मैसेज खुलता है।</div>
            {reqs === null ? <div className="boot" style={{ position: 'static', padding: 40 }}><div className="spin" /></div> : (
              !reqs.length ? (
                <div className="empty"><div className="em">🔔</div><h3>कोई अनुरोध नहीं</h3><div>लॉगिन स्क्रीन से भेजे गए सब्सक्रिप्शन अनुरोध यहाँ दिखेंगे।</div></div>
              ) : (
                <div className="adm-list">
                  {reqs.map((r) => (
                    <div className="adm-card" key={r._id}>
                      <div className="adm-top">
                        <div className="adm-nm">{r.name}<StatusTag status={r.status} /></div>
                        <div className="adm-when">{fmtDate(r.createdAt)}</div>
                      </div>
                      <div className="adm-meta">
                        <span>📱 {r.mobile}</span>
                        <span>🏠 {r.village || '—'}</span>
                        <span>🔑 {r.loginId}</span>
                        <span>📦 {r.plan || PLAN_DEFAULT}</span>
                      </div>
                      {r.note ? <div className="note">{r.note}</div> : null}
                      <div className="mact">
                        <button className="btn gold sm" disabled={busyId === r._id || r.status === 'approved'} onClick={() => setReqStatus(r._id, 'approved')}>✅ स्वीकृत</button>
                        <button className="btn sm" disabled={busyId === r._id || r.status === 'rejected'} onClick={() => setReqStatus(r._id, 'rejected')}>❌ अस्वीकृत</button>
                        <button className="btn sm" disabled={busyId === r._id || r.status === 'pending'} onClick={() => setReqStatus(r._id, 'pending')}>↺ पेंडिंग</button>
                        <button className="btn sm" onClick={() => whatsapp(r)}>💬 व्हाट्सएप</button>
                        <button className="btn sm" onClick={() => prefillUser(r)}>➕ यूज़र बनाएँ</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            </>
          ) : (
            <>
              <form className="adm-card" onSubmit={createUser}>
                <div className="adm-nm" style={{ marginBottom: 8 }}>➕ नया उपयोगकर्ता / यूज़र अपडेट</div>
                <div className="two">
                  <label className="fld">नाम<input value={form.name} onChange={set('name')} /></label>
                  <label className="fld">लॉगिन आईडी<input value={form.username} onChange={set('username')} autoCapitalize="off" autoCorrect="off" spellCheck="false" /></label>
                </div>
                <div className="two">
                  <label className="fld">पासवर्ड<input value={form.password} onChange={set('password')} placeholder="नया/बदलने के लिए" /></label>
                  <label className="fld">समाप्ति तिथि<input type="date" value={form.expiresAt} onChange={set('expiresAt')} /></label>
                </div>
                <label className="fld">भूमिका
                  <select value={form.role} onChange={set('role')}>
                    <option value="user">यूज़र</option>
                    <option value="admin">एडमिन</option>
                  </select>
                </label>
                <button className="btn pri" type="submit">💾 सेव करें</button>
              </form>

              {users === null ? <div className="boot" style={{ position: 'static', padding: 40 }}><div className="spin" /></div> : (
                <div className="adm-list">
                  {users.map((u) => (
                    <div className="adm-card" key={u.id}>
                      <div className="adm-top">
                        <div className="adm-nm">
                          {u.name}
                          {u.role === 'admin' ? <span className="tag sup">एडमिन</span> : <span className="tag">यूज़र</span>}
                          {u.active ? null : <span className="tag red">निष्क्रिय</span>}
                        </div>
                        <div className="adm-when">📅 {fmtDate(u.expiresAt)}</div>
                      </div>
                      <div className="adm-meta">
                        <span>🔑 {u.username}</span>
                        <span>{u.active ? '🟢 सक्रिय' : '🔴 निष्क्रिय'}</span>
                      </div>
                      {editing === u.id ? (
                        <div className="mact">
                          <input className="adm-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                          <button className="btn gold sm" disabled={busyId === u.id} onClick={() => saveExpiry(u)}>✓ सेव</button>
                          <button className="btn sm" onClick={() => setEditing(null)}>रद्द</button>
                        </div>
                      ) : (
                        <div className="mact">
                          <button className={'btn sm' + (u.active ? '' : ' gold')} disabled={busyId === u.id} onClick={() => toggleActive(u)}>
                            {u.active ? '⏸ निष्क्रिय करें' : '▶️ सक्रिय करें'}
                          </button>
                          <button className={'btn sm' + (u.role === 'admin' ? '' : ' gold')} disabled={busyId === u.id} onClick={() => changeRole(u)}>
                            {u.role === 'admin' ? '👤 यूज़र बनाएँ' : '🛡 एडमिन बनाएँ'}
                          </button>
                          <button className="btn sm" onClick={() => { setEditing(u.id); setEditDate(toDateInput(u.expiresAt)); }}>📅 तारीख बदलें</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
