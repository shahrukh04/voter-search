import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);

  const toast = useCallback((m) => {
    setMsg(m);
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return undefined;
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, [show, msg]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={'toast' + (show ? ' show' : '')}>{msg}</div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
