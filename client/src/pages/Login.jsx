import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
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
      tries.current += 1;
      setErr('❌ आईडी या पासवर्ड गलत है' + (tries.current >= 3 ? ` (${tries.current} कोशिशें)` : ''));
      setShake(true);
      setTimeout(() => setShake(false), 450);
      setPw('');
    } finally {
      setBusy(false);
    }
  }

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
        <button type="button" className="lnk" onClick={() => setMode('subscribe')}>सब्सक्रिप्शन नहीं है? अनुरोध भेजें →</button>
      </form>
    </div>
  );
}

function Subscribe({ config, onBack, message }) {
  const toast = useToast();
  const [form, setForm] = useState({ nm: '', mobile: '', village: 'जालिया द्वितीय', loginId: '' });
  const [err, setErr] = useState('');
  const contact = (config && config.contactMobile) || '6378375233';
  const plan = (config && config.plan) || '₹5,000 / माह';

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function send() {
    if (!form.nm.trim() || !/^[0-9]{10}$/.test(form.mobile.trim()) || !form.loginId.trim()) {
      setErr('नाम, 10 अंक का मोबाइल और लॉगिन आईडी भरें');
      return;
    }
    setErr('');
    const text =
      '🔔 जालिया मतदाता ऐप — सब्सक्रिप्शन अनुरोध\n' +
      'नाम: ' + form.nm + '\n' +
      'मोबाइल: ' + form.mobile + '\n' +
      'गाँव/पद: ' + form.village + '\n' +
      'चाही गई ID: ' + form.loginId + '\n' +
      'प्लान: ' + plan + '\n' +
      'भुगतान कर दिया है, कृपया चालू करें।';

    try {
      await api.subscribe({
        name: form.nm,
        mobile: form.mobile,
        village: form.village,
        loginId: form.loginId,
        plan,
      });
    } catch (e) {
      /* request logging is best-effort; WhatsApp still goes out */
    }
    window.open('https://wa.me/91' + contact + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    toast('✓ अनुरोध भेजा गया');
  }

  return (
    <div className="login" role="dialog" aria-label="सब्सक्रिप्शन">
      <span className="orb o1" />
      <span className="orb o2" />
      <div className="lcard">
        <div className="crest"><Crest /></div>
        <div className="own">Subscribe</div>
        <h2>सब्सक्रिप्शन</h2>
        <p>{message || 'जालिया द्वितीय · वार्ड मतदाता खोज'}</p>
        <div className="price">प्लान <b>₹5,000</b> / माह</div>
        <div className="payno">
          📱 <b>{contact}</b>
          <button type="button" className="cpb" onClick={() => { copyText(contact).then(() => toast('✓ कॉपी हो गया')); }}>कॉपी</button>
        </div>
        <label>आपका नाम<div className="in"><input value={form.nm} onChange={set('nm')} /></div></label>
        <label>मोबाइल नंबर<div className="in"><input value={form.mobile} inputMode="numeric" maxLength={10} onChange={set('mobile')} /></div></label>
        <label>गाँव / पद<div className="in"><input value={form.village} onChange={set('village')} /></div></label>
        <label>पसंदीदा लॉगिन आईडी<div className="in"><input value={form.loginId} onChange={set('loginId')} autoCapitalize="off" /></div></label>
        <button type="button" className="go" onClick={send}>✅ Subscribe — Admin को अनुरोध भेजें</button>
        <div className="err">{err}</div>
        <button type="button" className="lnk" onClick={onBack}>← लॉगिन पर वापस</button>
      </div>
    </div>
  );
}
