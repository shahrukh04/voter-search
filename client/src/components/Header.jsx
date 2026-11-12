import React, { useState } from 'react';
import Profile from './Profile.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

function Crest() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe9a6" />
          <stop offset="1" stopColor="#c79a1f" />
        </linearGradient>
      </defs>
      <path d="M8 46 L12 20 L24 32 L32 12 L40 32 L52 20 L56 46 Z" fill="url(#gg)" />
      <rect x="8" y="49" width="48" height="8" rx="3" fill="url(#gg)" />
    </svg>
  );
}

export default function Header({ subtitle, onOpenAdmin }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, config, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <>
    <header className="hero">
      <span className="orb a" />
      <span className="orb b" />
      <div className="wrap brand">
        <div className="crest"><Crest /></div>
        <div className="ttl">
          <div className="owner">{(config && config.owner) || 'Shahrukh'}</div>
          <h1>{(config && config.title) || 'जालिया द्वितीय ग्राम पंचायत'}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="icon-btn" onClick={() => setProfileOpen(true)} aria-label="मेरी प्रोफाइल">👤</button>
        {onOpenAdmin ? (
          <button className="icon-btn" onClick={onOpenAdmin} title="एडमिन पैनल" aria-label="एडमिन पैनल">🛡</button>
        ) : null}
        <button className="icon-btn" onClick={logout} title={user ? user.name : 'लॉग आउट'} aria-label="लॉग आउट">⎋</button>
        <button className="icon-btn" onClick={toggle} aria-label="थीम बदलें">{theme === 'dark' ? '☀️' : '🌙'}</button>
      </div>
    </header>
    {profileOpen && <Profile onClose={() => setProfileOpen(false)} />}
    </>
  );
}
