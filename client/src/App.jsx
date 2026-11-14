import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import SearchPage from './pages/SearchPage.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

export default function App() {
  const { booting, isAuthed, user } = useAuth();
  const [adminOpen, setAdminOpen] = useState(false);

  const [report, setReport] = useState(false);
  function openSearch(showReport) { setAdminOpen(false); setReport(showReport); window.scrollTo(0, 0); }
  const isAdmin = !!(user && user.role === 'admin');

  // non-admins (or after logout) must never keep the panel open
  useEffect(() => {
    if (!isAdmin) setAdminOpen(false);
  }, [isAdmin]);

  if (booting) {
    return (
      <div className="boot">
        <div className="spin" />
        <p>लोड हो रहा है…</p>
      </div>
    );
  }

  if (!isAuthed) return <Login />;

  if (adminOpen && isAdmin) return <AdminPanel onReports={() => openSearch(true)} onClose={() => openSearch(false)} />;

  return <SearchPage report={report} setReport={setReport} key={user.id} onOpenAdmin={isAdmin ? () => setAdminOpen(true) : null} />;
}
