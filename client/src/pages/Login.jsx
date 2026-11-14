import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import Profile from '../components/Profile.jsx';
import InstallApp from '../components/InstallApp.jsx';
import { copyText } from '../lib/format.js';

function Crest() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe9a6" />
          <stop offset="1" stopColor="#c79a1f" />
        </linearGradient>
      </defs>
      <path d="M8 46 L12 20 L24 32 L32 12 L40 32 L52 20 L56 46 Z" fill="url(#lg)" />
      <rect x="8" y="49" width="48" height="8" rx="3" fill="url(#lg)" />
    </svg>
  );
}

export default function Login() {
  const { login, config } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('login'); // 'login' | 'subscribe'
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const tries = useRef(0);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(id, pw);
    } catch (ex) {
      if (ex.data && ex.data.error === 'subscription_expired') {
        setMode('subscribe');
        setErr('');
        toast('सब्सक्रिप्शन ख़त्म — अनुरोध भेजें');
        setBusy(false);
        return;
      }
      if (ex.data?.error === 'device_limit_reached') {
        setErr('डिवाइस सीमा पूरी है। दूसरे डिवाइस से लॉग आउट करें या एडमिन से संपर्क करें।');
        return;
      }
      tries.current += 1;
      setErr('❌ आईडी या पासवर्ड गलत है' + (tries.current >= 3 ? ` (${tries.current} कोशिशें)` : ''));
      setShake(true);
      setTimeout(() => setShake(false), 450);
      setPw('');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'forgot') return <Profile recovery onClose={() => setMode('login')} />;

  if (mode === 'subscribe') {
    return <Subscribe config={config} onBack={() => setMode('login')} />;
  }

  return (
    <div className="login" role="dialog" aria-label="लॉगिन">
      <span className="orb o1" />
      <span className="orb o2" />
      <form className={'lcard' + (shake ? ' shake' : '')} onSubmit={onSubmit}>
        <div className="crest"><Crest /></div>
        <div className="own">{(config && config.owner) || 'Shahrukh'}</div>
        <h2>{(config && config.title) || 'जालिया द्वितीय ग्राम पंचायत'}</h2>
        <p>मतदाता खोज · लॉगिन करें</p>

        <label>
          लॉगिन आईडी
          <div className="in">
            <input value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck="false" required />
          </div>
        </label>
        <label>
          पासवर्ड
          <div className="in">
            <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} required />
            <button type="button" className="eye" onClick={() => setShowPw((s) => !s)} aria-label="पासवर्ड दिखाएँ">{showPw ? '🙈' : '👁'}</button>
          </div>
        </label>
        <button className="go" type="submit" disabled={busy}>{busy ? 'जाँच हो रही है…' : '🔐 लॉगिन'}</button>
        <div className="err" role="alert">{err}</div>
        <button type="button" className="lnk" onClick={() => setMode('forgot')}>पासवर्ड भूल गए? SMS से बदलें</button>
        <button type="button" className="lnk" onClick={() => setMode('subscribe')}>सब्सक्रिप्शन नहीं है? अनुरोध भेजें →</button>
        <InstallApp className="lnk" />
      </form>
    </div>
  );
}

function Subscribe({ config, onBack, message }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: '', mobile: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const contact = (config && config.contactMobile) || '6378375233';
  const plan = (config && config.plan) || '₹5,000 / माह';

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function send() {
    if (busy || sent) return;
    const username = form.username.trim();
    if (!username || !/^[0-9]{10}$/.test(form.mobile.trim()) || form.password.length < 4) {
      setErr('लॉगिन आईडी, 10 अंक का मोबाइल और 4+ अक्षर का पासवर्ड भरें');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      await api.subscribe({
        name: username,
        mobile: form.mobile.trim(),
        loginId: username,
        password: form.password,
        plan,
      });
      setSent(true);
      setForm(f => ({ ...f, password: '' }));
      toast('✓ अनुरोध एडमिन को भेज दिया गया');
    } catch (e) {
      setErr('अनुरोध सेव नहीं हुआ। कृपया दोबारा कोशिश करें।');
    } finally { setBusy(false); }
  }

  return (
    <div className="subscription-page">
      <div className="subscription-shell">
        <header className="subscription-header">
          <div className="subscription-brand"><div className="subscription-mark"><Crest /></div><div><strong>जालिया मतदाता खोज</strong><span>सब्सक्रिप्शन</span></div></div>
          <button type="button" className="subscription-back" onClick={onBack}>← लॉगिन पर वापस</button>
        </header>
        <main className="subscription-layout">
          <section className="subscription-payment" aria-labelledby="payment-title">
            <div className="subscription-payment-heading">
              <span className="subscription-eyebrow">मासिक सदस्यता</span>
              <h1 id="payment-title">अपनी खोज शुरू करें।</h1>
              <p>मतदाता खोज, वार्ड फ़िल्टर और परिवार की जानकारी एक जगह।</p>
              <div className="subscription-price">{plan}</div>
            </div>
            <figure className="subscription-qr">
              <a href="/images/subscription-payment.jpeg" target="_blank" rel="noopener noreferrer" aria-label="पेमेंट QR पूरा खोलें">
                <img src="/images/subscription-payment.jpeg" alt="MOHAMMED SHAHRUKH का PhonePe payment QR" width="843" height="1600" />
              </a>
              <figcaption>QR स्कैन करके भुगतान करें।</figcaption>
            </figure>
            <a className="subscription-download" href="/images/subscription-payment.jpeg" download="jaliya-payment-qr.jpeg">QR डाउनलोड करें ↓</a>
          </section>
          <section className="subscription-register" aria-labelledby="register-title">
            {sent ? <div className="subscription-success" role="status">
              <span aria-hidden="true">✓</span><h2 id="register-title">अनुरोध भेज दिया गया</h2>
              <p>आपका अनुरोध सेव हो गया है। एडमिन भुगतान की पुष्टि करके आपका खाता चालू करेंगे।</p>
              <button className="subscription-submit" onClick={onBack}>लॉगिन पर जाएँ →</button>
            </div> : <>
              <h2 id="register-title">खाते की जानकारी</h2>
              <p className="subscription-description">{message || 'भुगतान के बाद अपनी जानकारी भरकर अनुरोध भेजें। एडमिन की स्वीकृति के बाद लॉगिन कर सकेंगे।'}</p>
              <form onSubmit={event => { event.preventDefault(); send(); }}>
                <fieldset className="subscribe-fields" disabled={busy}>
                  <label>लॉगिन आईडी<input required autoComplete="username" value={form.username} onChange={set('username')} autoCapitalize="off" autoCorrect="off" spellCheck="false" placeholder="अपनी लॉगिन आईडी चुनें" /></label>
                  <label>मोबाइल नंबर<div className="subscription-phone"><span>+91</span><input required type="tel" autoComplete="tel-national" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.mobile} onChange={set('mobile')} placeholder="10 अंक का मोबाइल नंबर" /></div></label>
                  <label>पासवर्ड<input required minLength={4} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="कम से कम 4 अक्षर" /></label>
                </fieldset>
                {err && <p className="subscription-error" role="alert">{err}</p>}
                <button type="submit" className="subscription-submit" disabled={busy}>{busy ? 'अनुरोध भेजा जा रहा है…' : 'सब्सक्रिप्शन अनुरोध भेजें →'}</button>
              </form>
              <div className="subscription-help">
                <div><strong>भुगतान में सहायता चाहिए?</strong><span>{contact}</span></div>
                <button type="button" onClick={() => copyText(contact).then(() => toast('✓ नंबर कॉपी हो गया')).catch(() => toast('नंबर कॉपी नहीं हुआ'))}>नंबर कॉपी करें</button>
              </div>
            </>}
          </section>
        </main>
      </div>
    </div>
  );
}
