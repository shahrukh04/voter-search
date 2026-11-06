import React from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import SearchPage from './pages/SearchPage.jsx';

export default function App() {
  const { booting, isAuthed } = useAuth();

  if (booting) {
    return (
      <div className="boot">
        <div className="spin" />
        <p>लोड हो रहा है…</p>
      </div>
    );
  }

  return isAuthed ? <SearchPage /> : <Login />;
}
