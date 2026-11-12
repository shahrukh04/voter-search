import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile({ onClose, recovery = false }) {
  const { user, logout } = useAuth();
  const [forgot, setForgot] = useState(recovery);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setMessage('दोनों नए पासवर्ड एक जैसे होने चाहिए।'); return; }
    setBusy(true);
    setMessage('');
    try {
      await api.changePassword({ oldPassword, newPassword, ...(mobile ? { mobile } : {}) });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDone(true);
    } catch (error) {
      const messages = {
        incorrect_password: 'पुराना पासवर्ड गलत है।',
        invalid_password: 'नया पासवर्ड कम से कम 6 अक्षर और अधिकतम 72 bytes का होना चाहिए।',
        invalid_mobile: '10 अंक का मोबाइल नंबर भरें।',
        password_changed: 'पासवर्ड बदल चुका है। दोबारा लॉगिन करें।',
      };
      setMessage(messages[error.message] || 'पासवर्ड सेव नहीं हुआ। दोबारा कोशिश करें।');
    } finally { setBusy(false); }
  }

  return (
    <div className="modal show" role="dialog" aria-modal="true" aria-labelledby="profile-heading">
      <div className="sheet profile-sheet">
        <div className="mh">
          <h2 id="profile-heading">{forgot ? 'पासवर्ड भूल गए?' : 'मेरी प्रोफाइल'}</h2>
          <button className="xm" onClick={done ? logout : onClose} aria-label="बंद करें">✕</button>
        </div>
        {done ? (
          <><p role="status">पासवर्ड बदल गया। सभी डिवाइस से लॉग आउट कर दिया गया है। नए पासवर्ड से लॉगिन करें।</p><button className="btn pri" onClick={logout}>लॉगिन पर जाएँ</button></>
        ) : forgot ? (
          <>
            <p>SMS / WhatsApp OTP सेवा अभी चालू नहीं है। पासवर्ड reset करने के लिए एडमिन से संपर्क करें।</p>
            <button className="btn" onClick={recovery ? onClose : () => setForgot(false)}>← वापस</button>
          </>
        ) : (
          <>
            <p>{user?.name} · {user?.username}</p>
            <form onSubmit={save}>
              <label className="fld">मोबाइल नंबर
                <input type="tel" autoComplete="tel-national" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value)} />
              </label>
              <label className="fld">पुराना पासवर्ड
                <input type="password" autoComplete="current-password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
              </label>
              <label className="fld">नया पासवर्ड
                <input type="password" autoComplete="new-password" minLength={6} maxLength={72} required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </label>
              <label className="fld">नया पासवर्ड दोबारा लिखें
                <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </label>
              <p>पासवर्ड बदलने पर सभी डिवाइस से लॉग आउट होगा।</p>
              <p role="status">{message}</p>
              <button className="btn pri" disabled={busy}>{busy ? 'सेव हो रहा है…' : 'पासवर्ड सेव करें'}</button>
              <button className="btn" type="button" onClick={() => setForgot(true)}>पासवर्ड भूल गए?</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
