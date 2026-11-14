import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { exportCSV, fmt } from '../lib/format.js';
import { defaultState, houseKey, PAGE_F, PAGE_V, parseQuery, prepare, REL_PLACEHOLDER, run, SMODE_PLACEHOLDER, SMODES, suggest } from '../lib/search.js';

import VoteReport from './VoteReport.jsx';
import Header from '../components/Header.jsx';
import SearchBar from '../components/SearchBar.jsx';
import WardChips from '../components/WardChips.jsx';
import Stats from '../components/Stats.jsx';
import Filters from '../components/Filters.jsx';
import VoterCard from '../components/VoterCard.jsx';
import FamilyCard from '../components/FamilyCard.jsx';
import RecordModal from '../components/RecordModal.jsx';
import EditsModal from '../components/EditsModal.jsx';

export default function SearchPage({ onOpenAdmin }) {
  const { user } = useAuth();
  const toast = useToast();
  // क्रमांक/वार्ड सुधारने का विकल्प केवल एडमिन को दिखता है।
  const isAdmin = user?.role === 'admin';

  const [report, setReport] = useState(false);
  const [owner, setOwner] = useState(user.id);
  const [voteData, setVoteData] = useState(null);
  const [voteError, setVoteError] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);
  const [voteRevision, setVoteRevision] = useState(0);
  const marks = voteData?.owner === owner ? voteData.ids : null;
  const retryVotes = () => setVoteRevision(v => v + 1);
  useEffect(() => {
    let alive = true;
    setVoteError(false);
    api.voteMarks(owner).then(({ ids }) => {
      if (alive) setVoteData({ owner, ids: new Set(ids) });
    }).catch(() => { if (alive) { setVoteData(null); setVoteError(true); } });
    return () => { alive = false; };
  }, [owner, voteRevision, report]);

  async function changeVote(r, voted) {
    if (voteBusy || !marks) return;
    if (!voted && !window.confirm(r.n + ' का मतदान टिक हटाएँ?')) return;
    setVoteBusy(true);
    try {
      await api.setVote(owner, r.i, voted);
      setVoteData(previous => {
        if (previous?.owner !== owner) return previous;
        const ids = new Set(previous.ids);
        if (voted) ids.add(r.i); else ids.delete(r.i);
        return { owner, ids };
      });
      toast(voted ? 'वोट दिया दर्ज हुआ' : 'मतदान टिक हटाया गया');
    } catch { toast('बदलाव सेव नहीं हुआ। फिर कोशिश करें।'); }
    finally { setVoteBusy(false); }
  }

  const [rawVoters, setRawVoters] = useState(null);
  const [edits, setEdits] = useState({});
  const [loadErr, setLoadErr] = useState('');
  const [S, setS] = useState(defaultState);
  const [page, setPage] = useState(0); // 0-based वर्तमान पेज
  const [printAll, setPrintAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modal, setModal] = useState(null); // {type:'record', i} | {type:'edits'}
  const [sugList, setSugList] = useState([]);
  const [sugList2, setSugList2] = useState([]);
  const sugTimer = useRef(null);

  /* ---------- load data ---------- */
  const fetchData = useCallback(async () => {
    const [v, e] = await Promise.all([api.getVoters(), api.getEdits()]);
    return { voters: v.voters || [], edits: e.edits || {} };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchData();
        if (!alive) return;
        setRawVoters(d.voters);
        setEdits(d.edits);
      } catch (ex) {
        if (alive) setLoadErr('डेटा लोड नहीं हो सका — सर्वर कनेक्शन जाँचें।');
      }
    })();
    return () => { alive = false; };
  }, [fetchData]);

  // रीफ़्रेश — सारे फ़िल्टर/खोज हटाकर डेटा दोबारा लाता है (अकेले नतीजे से बाहर
  // निकलने का आसान तरीका), और पूरी वेबसाइट reload करने की ज़रूरत नहीं पड़ती।
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const d = await fetchData();
      setRawVoters(d.voters);
      setEdits(d.edits);
      setLoadErr('');
      setS((s) => ({ ...defaultState, view: s.view }));
      setPage(0);
      setPanelOpen(false);
      setModal(null);
      toast('✓ सारे फ़िल्टर हटे — पूरा डेटा दिख रहा है');
    } catch (ex) {
      toast('⚠ रीफ़्रेश नहीं हो सका — सर्वर जाँचें');
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, refreshing, toast]);

  const ctx = useMemo(() => (rawVoters ? prepare(rawVoters, edits) : null), [rawVoters, edits]);

  const result = useMemo(() => (ctx ? run(ctx, S) : { toks: [], RES: [], wardCnt: {}, NOHOUSE: 0, MATCH: null }), [ctx, S]);
  const { RES, wardCnt, NOHOUSE, MATCH } = result;

  const qWords = useMemo(() => {
    const arr = parseQuery(S.q);
    if (S.smode === 'dono' && S.q2) arr.push(...parseQuery(S.q2));
    return arr.filter((k) => k.t === 'name').map((k) => k.v);
  }, [S.q, S.q2, S.smode]);

  const mohallaOpts = useMemo(() => {
    if (!ctx) return [];
    const pool = ctx.DATA.filter((r) => !r.d && (!S.ward || r.w === +S.ward));
    const c = {};
    pool.forEach((r) => { if (r.m) c[r.m] = (c[r.m] || 0) + 1; });
    return Object.keys(c).sort().map((k) => [k, c[k]]);
  }, [ctx, S.ward]);

  // result/व्यू बदलने पर पहले पेज पर लौटें
  useEffect(() => {
    setPage(0);
  }, [RES, S.view]);

  // debounced suggestions
  useEffect(() => {
    if (!ctx) return undefined;
    clearTimeout(sugTimer.current);
    sugTimer.current = setTimeout(() => {
      const side = S.smode === 'pita' ? 'r' : 'n';
      setSugList(suggest(ctx, S, side));
      setSugList2(S.smode === 'dono' ? suggest(ctx, S, 'r') : []);
    }, 120);
    return () => clearTimeout(sugTimer.current);
  }, [ctx, S]);

  /* ---------- derived ---------- */
  const subtitle = useMemo(() => {
    if (!ctx) return 'लोड हो रहा है…';
    if (S.view === 'voters') return `कुल ${fmt(ctx.ACT)} मतदाता`;
    return `${fmt(ctx.FAMCOUNT)} परिवार / मकान`;
  }, [ctx, S.view]);

  const active = modal && modal.type === 'record' ? ctx && ctx.BYI.get(modal.i) : null;

  /* ---------- edit persistence ---------- */
  const persist = useCallback(async (next) => {
    setEdits(next);
    try {
      await api.saveEdits(next);
    } catch (e) {
      toast('⚠ सर्वर पर सेव नहीं हुआ');
    }
  }, [toast]);

  const saveEdit = useCallback((i, w, s) => {
    const r = ctx.BYI.get(i);
    const next = { ...edits };
    if (+w === r.w0 && String(s) === r.s0) delete next[i];
    else next[i] = { n: r.n, w: +w, s: String(s) };
    persist(next);
    toast('✓ सुधार सेव हुआ — हर जगह बदल गया');
  }, [ctx, edits, persist, toast]);

  const resetEdit = useCallback((i) => {
    const next = { ...edits };
    delete next[i];
    persist(next);
    toast('↺ मूल मान वापस');
  }, [edits, persist, toast]);

  const restoreEdits = useCallback(async (obj) => {
    const clean = {};
    let n = 0;
    for (const k of Object.keys(obj || {})) {
      const e = obj[k];
      const i = +k;
      const r = ctx.BYI.get(i);
      if (r && e && e.n === r.n && Number.isInteger(+e.w) && +e.w >= 1 && +e.w <= 99 && String(e.s).trim()) {
        clean[i] = { n: r.n, w: +e.w, s: String(e.s).trim() };
        n++;
      }
    }
    await persist(clean);
    toast('✓ ' + n + ' सुधार वापस आए');
  }, [ctx, persist, toast]);

  const clearAllEdits = useCallback(async () => {
    if (!confirm('सभी सुधार हटाकर मूल क्रमांक/वार्ड वापस करें?')) return;
    await persist({});
    toast('↺ सब सुधार हटाए');
  }, [persist, toast]);

  /* ---------- actions ---------- */
  const resetFilters = useCallback(() => {
    setS((s) => ({ ...defaultState, q: '', view: s.view, sort: 'rel' }));
    toast('फ़िल्टर हटा दिए');
  }, [toast]);

  const setView = useCallback((v) => {
    setS((s) => (s.view === v ? s : { ...s, view: v, sort: 'rel' }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const showVotersForHouse = useCallback((r) => {
    setModal(null);
    setS((s) => ({ ...s, view: 'voters', q: '', ward: String(r.w), moh: r.m, h: r.h, sort: 'rel' }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const showFamilyFor = useCallback((r) => {
    setModal(null);
    setS((s) => ({ ...s, view: 'family', q: '', ward: String(r.w), moh: r.m, h: r.h, sort: 'rel' }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const otherMembers = useCallback((r) => {
    if (!ctx) return [];
    const f = ctx.FAM.get(houseKey(r));
    return f ? f.mem.filter((x) => x.i !== r.i) : [];
  }, [ctx]);

  const handlePrint = useCallback(() => {
    setPrintAll(true);
    setTimeout(() => { window.print(); setPrintAll(false); }, 80);
  }, []);

  if (loadErr) {
    return (
      <div className="boot">
        <p style={{ color: '#c0392b', fontWeight: 700 }}>{loadErr}</p>
        <button className="btn" onClick={() => window.location.reload()}>↻ फिर कोशिश करें</button>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="boot">
        <div className="spin" />
        <p>मतदाता डेटा लोड हो रहा है…</p>
      </div>
    );
  }

  if (report) return <VoteReport records={ctx.DATA} user={user} owner={owner} setOwner={setOwner} marks={marks}
    pending={voteBusy} onRemove={r => changeVote(r, false)} error={voteError} retry={retryVotes}
    onClose={() => { setOwner(user.id); setReport(false); }} />;

  const fam = S.view === 'family';
  const per = fam ? PAGE_F : PAGE_V;
  const pages = Math.max(1, Math.ceil(RES.length / per));
  const cur = Math.min(page, pages - 1);
  const visible = printAll ? RES : RES.slice(cur * per, cur * per + per);

  return (
    <>
      <Header subtitle={subtitle} onOpenAdmin={onOpenAdmin} />

      <div className="stickybar">
        <div className="wrap">
          <div className="srow">
            <SearchBar
              value={S.q}
              onChange={(v) => setS((s) => ({ ...s, q: v }))}
              onPick={(n) => setS((s) => ({ ...s, q: n }))}
              suggestions={sugList}
              qWords={qWords}
              placeholder={SMODE_PLACEHOLDER[S.smode] || SMODE_PLACEHOLDER.naam}
            />
            <div className="seg" data-on={S.view}>
              <span className="pill" />
              <button className={S.view === 'voters' ? 'on' : ''} onClick={() => setView('voters')}>🗳 मतदाता</button>
              <button className={S.view === 'family' ? 'on' : ''} onClick={() => setView('family')}>🏠 परिवार</button>
            </div>
          </div>
          {S.smode === 'dono' ? (
            <div className="srow sub">
              <span className="sublab">पिता/पति का नाम</span>
              <SearchBar
                value={S.q2}
                onChange={(v) => setS((s) => ({ ...s, q2: v }))}
                onPick={(n) => setS((s) => ({ ...s, q2: n }))}
                suggestions={sugList2}
                qWords={qWords}
                placeholder={REL_PLACEHOLDER}
                shortcut={false}
              />
            </div>
          ) : null}
          <div className="modes">
            <span className="mlab">कहाँ खोजें:</span>
            {SMODES.map(([v, t]) => (
              <button
                key={v}
                className={'wc' + (S.smode === v ? ' on' : '')}
                onClick={() => setS((s) => ({ ...s, smode: v }))}
              >
                {t}
              </button>
            ))}
          </div>
          <WardChips wards={ctx.WARDS} active={S.ward} counts={wardCnt} onPick={(w) => setS((s) => ({ ...s, ward: w, moh: '' }))} />
        </div>
      </div>

      <main>
        <div className="wrap layout">
          <Filters
            S={S}
            setS={setS}
            mohallaOpts={mohallaOpts}
            resultCount={RES.length}
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            onReset={resetFilters}
          />

          <section>
            <Stats view={S.view} RES={RES} />

            <div className="bar">
              <span className="cnt">{fmt(RES.length)}{fam ? ' परिवार' : ' परिणाम'}{RES.length > per ? ` · पेज ${cur + 1}/${pages}` : ''}</span>
              <div className="mact">
                <button className="btn sm" onClick={() => { setReport(true); window.scrollTo(0, 0); }}>मतदान रिपोर्ट</button>
                {voteError && <button className="btn sm" onClick={retryVotes}>मतदान डेटा फिर लाएँ</button>}
                <button className="btn sm" onClick={refresh} disabled={refreshing} title="सारे फ़िल्टर/खोज हटाकर पूरा डेटा दोबारा लाएँ (पूरी वेबसाइट reload नहीं)">
                  <span className={'ric' + (refreshing ? ' spin' : '')}>↻</span>{refreshing ? ' रीफ़्रेश…' : ' रीफ़्रेश'}
                </button>
                <button className="btn sm" onClick={() => setModal({ type: 'edits' })} hidden={!isAdmin}>
                  ✎ सुधार{Object.keys(edits).length ? <b className="bdg">{Object.keys(edits).length}</b> : null}
                </button>
                <button className="btn sm" onClick={() => exportCSV(S, RES)}>⬇ CSV</button>
                <button className="btn sm" onClick={handlePrint}>🖨 प्रिंट</button>
              </div>
            </div>

            {fam && NOHOUSE ? (
              <div className="note">ℹ️ {fmt(NOHOUSE)} मतदाताओं का मकान नंबर नहीं है, इसलिए वे परिवार व्यू में नहीं दिखते — "मतदाता" व्यू में देखें।</div>
            ) : null}

            {!RES.length ? (
              <div className="empty">
                <div className="em">🔍</div>
                <h3>कोई {fam ? 'परिवार' : 'नाम'} नहीं मिला</h3>
                <div>
                  वर्तनी बदलकर देखें, या कुछ फ़िल्टर हटाएँ।
                  <br /><small>Roman में भी लिख सकते हैं: ramesh, bhanwar…</small>
                </div>
              </div>
            ) : (
              <div className={'grid' + (fam ? ' f' : '')}>
                {visible.map((x, i) => (
                  fam ? (
                    <FamilyCard
                      key={x.k}
                      f={x}
                      k={i}
                      MATCH={MATCH}
                      qWords={qWords}
                      onOpenRecord={(idx) => setModal({ type: 'record', i: idx })}
                      onMembers={showVotersForHouse}
                      toast={toast}
                    />
                  ) : (
                    <VoterCard
                      key={x.i}
                      r={x}
                      voted={marks?.has(x.i) || false}
                      voteDisabled={!marks || voteBusy || (marks.has(x.i) && !user.superAdmin)}
                      onVote={r => changeVote(r, !marks.has(r.i))}
                      k={i}
                      qWords={qWords}
                      fa={S.fa}
                      smode={S.smode}
                      onOpen={(idx) => setModal({ type: 'record', i: idx })}
                      onHouse={showVotersForHouse}
                    />
                  )
                ))}
              </div>
            )}

            {RES.length > per ? (
              <div className="pager">
                <button
                  className="btn"
                  disabled={cur === 0}
                  onClick={() => { setPage(Math.max(0, cur - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  ← पिछला
                </button>
                <span className="pgtxt">
                  पेज <b>{cur + 1}</b> / {pages}
                  <small>· {fmt(cur * per + 1)}–{fmt(Math.min(RES.length, (cur + 1) * per))} दिख रहे हैं</small>
                </span>
                <button
                  className="btn pri"
                  disabled={cur >= pages - 1}
                  onClick={() => { setPage(Math.min(pages - 1, cur + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  अगला →
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <footer>
          {user ? user.name + ' · ' : ''}जालिया मतदाता खोज
        </footer>
      </main>

      <nav className="tabbar">
        <button className={S.view === 'voters' && !panelOpen ? 'on' : ''} onClick={() => { setPanelOpen(false); setView('voters'); }}>
          <span className="ic">🗳</span>मतदाता
        </button>
        <button className={S.view === 'family' && !panelOpen ? 'on' : ''} onClick={() => { setPanelOpen(false); setView('family'); }}>
          <span className="ic">🏠</span>परिवार
        </button>
        {isAdmin ? (
          <button className={modal && modal.type === 'edits' ? 'on' : ''} onClick={() => { setModal({ type: 'edits' }); }}>
            <span className="ic">✎</span>सुधार
            {Object.keys(edits).length ? <i className="badge">{Object.keys(edits).length}</i> : null}
          </button>
        ) : null}
        <button className={panelOpen ? 'on' : ''} onClick={() => setPanelOpen((o) => !o)}>
          <span className="ic">⚙️</span>फ़िल्टर
          {countFilters(S) ? <i className="badge">{countFilters(S)}</i> : null}
        </button>
      </nav>

      <div className={'scrim' + (panelOpen ? ' show' : '')} onClick={() => setPanelOpen(false)} />

      {modal && modal.type === 'edits' ? (
        <EditsModal
          edits={edits}
          byId={(i) => ctx.BYI.get(i)}
          onClose={() => setModal(null)}
          onRestore={restoreEdits}
          onClearAll={clearAllEdits}
          toast={toast}
        />
      ) : null}

      {active ? (
        <RecordModal
          key={active.i}
          r={active}
          others={otherMembers(active)}
          qWords={qWords}
          fa={S.fa}
          wards={ctx.WARDS}
          onClose={() => setModal(null)}
          onOpenRecord={(i) => setModal({ type: 'record', i })}
          onEditSave={saveEdit}
          onResetEdit={resetEdit}
          onShowFamily={showFamilyFor}
          canEdit={isAdmin}
          toast={toast}
        />
      ) : null}
    </>
  );
}

function countFilters(S) {
  return (
    ['ward', 'moh', 'g', 'rel', 'h', 'l', 'e'].filter((k) => S[k] !== '').length +
    (S.amin !== '' || S.amax !== '' ? 1 : 0) +
    (S.dup ? 1 : 0) + (S.del ? 1 : 0) + (S.fa && S.smode === 'naam' ? 1 : 0)
  );
}
