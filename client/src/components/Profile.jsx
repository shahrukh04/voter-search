import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile({ onClose, recovery = false }) {
  const { user, logout } = useAuth();
  const dialogRef = useRef(null);
  const [username, setUsername] = useState(user?.username || '');
  const [channel, setChannel] = useState('sms');
  const [requestId, setRequestId] = useState('');
  const [code, setCode] = useState('');
  const [forgot, setForgot] = useState(recovery);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();
    function keyboard(event) {
      if (event.key === 'Escape' && !busy) { done ? logout() : onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
      previous?.focus();
    };
  }, [busy, done, logout, onClose]);

  const errors = {
    otp_unavailable: 'OTP सेवा की configuration अभी पूरी नहीं है।',
    otp_provider_error: 'OTP सेवा से संपर्क नहीं हुआ। थोड़ी देर बाद प्रयास करें।',
    otp_rate_limit: 'बहुत अधिक प्रयास हुए। कुछ समय बाद कोशिश करें।',
    invalid_otp: 'OTP गलत, समाप्त या इस्तेमाल हो चुका है। नया OTP माँगें।',
    invalid_recovery_details: 'लॉगिन आईडी और 10 अंक का सेव किया नंबर भरें।',
    invalid_reset_details: 'OTP और कम से कम 6 अक्षर का नया पासवर्ड भरें।',
  };

  async function sendOtp(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await api.requestOtp({ username, mobile, channel });
      setRequestId(result.requestId);
      setCode('');
      setMessage(result.message);
    } catch (error) { setMessage(errors[error.message] || 'OTP नहीं भेजा गया।'); }
    finally { setBusy(false); }
  }

  async function reset(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setMessage('दोनों नए पासवर्ड एक जैसे होने चाहिए।'); return; }
    setBusy(true);
    try {
      await api.resetPassword({ requestId, code, newPassword });
      setCode(''); setNewPassword(''); setConfirmPassword(''); setDone(true);
    } catch (error) { setMessage(errors[error.message] || 'पासवर्ड नहीं बदला।'); }
    finally { setBusy(false); }
  }

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
    <div className="modal show profile-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-heading">
      <div className="sheet profile-sheet">
        <div className="mh profile-header">
          <h2 id="profile-heading">{forgot ? 'पासवर्ड भूल गए?' : 'मेरी प्रोफाइल'}</h2>
          <button className="xm" disabled={busy} onClick={done ? logout : onClose} aria-label="बंद करें">✕</button>
        </div>
        <div className="profile-content">
        {done ? (
          <div className="profile-success"><span className="profile-success-icon" aria-hidden="true">✓</span><h3>पासवर्ड बदल गया</h3><p role="status">पासवर्ड बदल गया। सभी डिवाइस से लॉग आउट कर दिया गया है। नए पासवर्ड से लॉगिन करें।</p><button className="btn pri" onClick={logout}>लॉगिन पर जाएँ →</button></div>
        ) : forgot ? (
          <>
            <p className="profile-description">अपने खाते में सेव किए मोबाइल नंबर पर OTP मँगाकर नया पासवर्ड बनाएँ।</p>
            {!requestId ? <form onSubmit={sendOtp}>
              <label className="fld">लॉगिन आईडी<input required value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" /></label>
              <label className="fld">सेव किया मोबाइल नंबर<input type="tel" required pattern="[0-9]{10}" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value)} /></label>
              <label className="fld">OTP कैसे भेजें<select value={channel} onChange={e => setChannel(e.target.value)}><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></label>
              <button className="btn pri" disabled={busy}>{busy ? 'भेजा जा रहा है…' : 'OTP भेजें →'}</button>
            </form> : <form onSubmit={reset}>
              <label className="fld">OTP<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{4,10}" required value={code} onChange={e => setCode(e.target.value)} /></label>
              <label className="fld">नया पासवर्ड<input type="password" autoComplete="new-password" minLength={6} maxLength={72} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
              <label className="fld">नया पासवर्ड दोबारा<input type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
              <button className="btn pri" disabled={busy}>{busy ? 'जाँच हो रही है…' : 'पासवर्ड बदलें'}</button>
              <button className="btn" type="button" disabled={busy} onClick={() => { setRequestId(''); setMessage(''); }}>नया OTP माँगें</button>
            </form>}
            {message && <p className="profile-feedback" role="status">{message}</p>}
            <button className="btn" disabled={busy} onClick={recovery ? onClose : () => { setForgot(false); setMessage(''); }}>← वापस</button>
          </>
        ) : (
          <>
            <section className="profile-account" aria-label="खाते की जानकारी">
              <div className="profile-avatar" aria-hidden="true">{user?.name?.trim().slice(0, 1) || 'U'}</div>
              <div className="profile-identity"><h3>{user?.name}</h3><span>@{user?.username}</span></div>
              <span className="profile-role">{user?.superAdmin ? 'सुपर एडमिन' : user?.role === 'admin' ? 'एडमिन' : 'सदस्य'}</span>
            </section>
            <div className="profile-section-title"><h3>पासवर्ड बदलें</h3><p>अपने पुराने पासवर्ड से बदलाव की पुष्टि करें।</p></div>
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
              <p className="profile-hint">नया पासवर्ड कम से कम 6 अक्षर का रखें। सेव करने पर सभी डिवाइस से लॉग आउट होगा।</p>
              {message && <p className="profile-feedback" role="status">{message}</p>}
              <button className="btn pri" disabled={busy}>{busy ? 'सेव हो रहा है…' : 'पासवर्ड सेव करें'}</button>
              <button className="btn profile-text-button" type="button" disabled={busy} onClick={() => { setForgot(true); setMessage(''); }}>पासवर्ड भूल गए?</button>
            </form>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
