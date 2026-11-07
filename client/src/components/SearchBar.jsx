import React, { useEffect, useRef, useState } from 'react';
import { highlightWords } from '../lib/format.js';

export default function SearchBar({ value, onChange, onPick, suggestions, qWords, placeholder }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!suggestions.length) { setOpen(false); setIdx(-1); }
  }, [suggestions]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      setIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      if (open && idx >= 0) { e.preventDefault(); pick(idx); }
      else { setOpen(false); inputRef.current && inputRef.current.blur(); }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function pick(i) {
    const e = suggestions[i];
    if (!e) return;
    setOpen(false);
    onPick(e.n);
  }

  function handleChange(e) {
    onChange(e.target.value);
    setOpen(!!e.target.value);
  }

  // global "/" shortcut
  useEffect(() => {
    function onDoc(e) {
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault();
        inputRef.current && inputRef.current.focus();
      }
    }
    document.addEventListener('keydown', onDoc);
    return () => document.removeEventListener('keydown', onDoc);
  }, []);

  return (
    <div className="sb">
      <svg className="mag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        spellCheck="false"
        enterKeyHint="search"
        placeholder={placeholder || 'नाम लिखें — मात्रा की चिंता नहीं: रमेश / ramesh / 145'}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onFocus={() => { if (value) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {value ? (
        <button className="clear" aria-label="साफ़ करें" onClick={() => { onChange(''); setOpen(false); inputRef.current && inputRef.current.focus(); }}>×</button>
      ) : null}
      {open && suggestions.length ? (
        <div className="sug">
          {suggestions.map((e, i) => (
            <div key={i} className={i === idx ? 'on' : ''} onMouseDown={(ev) => { ev.preventDefault(); pick(i); }}>
              <span>{highlightWords(e.n, qWords)}</span>
              <span className="meta">
                {e.c} नाम · वार्ड {[...e.w].sort((a, b) => a - b).join(', ')} · क्र. {e.sr.slice(0, 3).join(', ')}
                {e.sr.length > 3 ? '…' : ''}
              </span>
            </div>
          ))}
          <div className="foot">↑↓ से चुनें, Enter दबाएँ — या नीचे सभी परिणाम देखें</div>
        </div>
      ) : null}
    </div>
  );
}
