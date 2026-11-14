import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Profile from './Profile.jsx';
import InstallApp from './InstallApp.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SideMenu({ onReports, onList, onAdmin }) {
  const dialog = useRef(null);
  const { user } = useAuth();
  const [profile, setProfile] = useState(false);
  function navigate(action) {
    dialog.current.close();
    action();
  }
  return <>
    <button className="icon-btn" aria-label="मेन्यू खोलें" aria-haspopup="dialog" onClick={() => dialog.current.showModal()}>☰</button>
    {createPortal(<dialog ref={dialog} className="side-menu" aria-label="मुख्य मेन्यू"
      onClick={event => { if (event.target === event.currentTarget && event.clientX > event.currentTarget.getBoundingClientRect().right) dialog.current.close(); }}>
      <header><h2>मेन्यू</h2><button className="btn sm" aria-label="मेन्यू बंद करें" onClick={() => dialog.current.close()}>✕</button></header>
      <p>{user.name} · {user.username}</p>
      <nav aria-label="मुख्य नेविगेशन">
        <button onClick={() => navigate(onList)}>मतदाता सूची</button>
        <button onClick={() => navigate(() => setProfile(true))}>मेरी प्रोफाइल</button>
        <button onClick={() => navigate(onReports)}>पर्ची वितरण रिपोर्ट</button>
        {onAdmin && <button onClick={() => navigate(onAdmin)}>एडमिन पैनल</button>}
        <InstallApp />
      </nav>
    </dialog>, document.body)}
    {profile && createPortal(<Profile onClose={() => setProfile(false)} />, document.body)}
  </>;
}
