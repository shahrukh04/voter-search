import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setTokenGetter } from '../lib/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'jv-token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  });
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [booting, setBooting] = useState(true);

  setTokenGetter(() => token);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => setConfig({ owner: 'Shahrukh', title: 'जालिया द्वितीय ग्राम पंचायत', contactMobile: '6378375233', plan: '₹5,000 / माह' }));
  }, []);

  useEffect(() => {
    let alive = true;
    async function boot() {
      if (!token) { setBooting(false); return; }
      try {
        const { user: u } = await api.me();
        if (alive) setUser(u);
      } catch (e) {
        if (alive) {
          setToken(null);
          try { localStorage.removeItem(TOKEN_KEY); } catch (err) { /* ignore */ }
        }
      } finally {
        if (alive) setBooting(false);
      }
    }
    boot();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function checkSession() {
      if (document.hidden) return;
      try { await api.me(); }
      catch (error) {
        if (active && error.status === 401) {
          setToken(null);
          setUser(null);
          if (localStorage.getItem(TOKEN_KEY) === token) localStorage.removeItem(TOKEN_KEY);
        }
      }
    }
    const timer = setInterval(checkSession, 15000);
    document.addEventListener('visibilitychange', checkSession);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, [token, user?.role]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    setToken(res.token);
    setUser(res.user);
    try { localStorage.setItem(TOKEN_KEY, res.token); } catch (e) { /* ignore */ }
    return res.user;
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    setToken(null);
    setUser(null);
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }, []);

  const value = useMemo(
    () => ({ token, user, config, booting, login, logout, isAuthed: !!token && !!user }),
    [token, user, config, booting, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
