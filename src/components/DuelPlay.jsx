// src/components/DuelPlay.jsx
import React, { useEffect, useRef, useState } from "react";

/*
  DuelPlay component (modal-style)
  - Full-screen page/modal — should cover navbar and page content.
  - Slots forced horizontal (no wrapping). When space is tight they scroll horizontally.
  - ProfileModal (if present) will still render above this because ProfileModal uses z-index:75.
*/

const BACKGROUND_SONGS = [
  "/audios/city_battle_stars.mp3",
  "/audios/cinematic_battle.mp3",
  "/audios/fun_battle.mp3",
  "/audios/retro_battle.mp3",
];

const SLOT_AUDIO = "/audios/slot.mp3";
const SILENT_AUDIO = "/audios/silent.mp3";

function posterFor(movie) {
  if (!movie) return null;
  if (movie.poster_path) return `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
  if (movie.poster) return movie.poster;
  if (movie.image) return movie.image;
  if (movie.posterUrl) return movie.posterUrl;
  if (movie.raw && movie.raw.poster_path) return `https://image.tmdb.org/t/p/w342${movie.raw.poster_path}`;
  if (movie.raw && movie.raw.poster) return movie.raw.poster;
  return null;
}

async function fetchProfileBySlug(slug) {
  if (!slug) return null;
  try {
    const byNick = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byNick.ok) {
      const txt = await byNick.text();
      try { const json = JSON.parse(txt); return json.profile || json; } catch (e) {}
    }
  } catch (e) {}
  try {
    const byId = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byId.ok) {
      const txt = await byId.text();
      try { const json = JSON.parse(txt); return json.profile || json; } catch (e) {}
    }
  } catch (e) {}
  return null;
}

/* computeStats / distributeAttackPoints (same as your previous implementation) */
function computeStats(deckArr) {
  const movies = (deckArr || []).filter(Boolean);
  if (movies.length === 0) return { pretentious: 0, rewatch: 0, quality: 0, popularity: 0 };

  const scores = movies.map(m => (m.vote_average || 0));
  const pops = movies.map(m => (m.popularity || 0));

  const minPop = Math.min(...pops);
  const maxPop = Math.max(...pops);
  const normPops = pops.map(p => (maxPop === minPop ? 0.5 : (p - minPop) / (maxPop - minPop)));

  const normScores = scores.map(s => Math.min(1, Math.max(0, s / 10)));

  const quality = scores.reduce((a, b) => a + b, 0) / scores.length;
  const popularity = pops.reduce((a, b) => a + b, 0) / pops.length;

  const pretArr = normScores.map((ns, idx) => ns * (1 - normPops[idx]));
  const pretentious = (pretArr.reduce((a, b) => a + b, 0) / pretArr.length) * 100;

  const rewatchArr = normScores.map((ns, idx) => ns * normPops[idx]);
  const rewatch = (rewatchArr.reduce((a, b) => a + b, 0) / rewatchArr.length) * 100;

  return {
    pretentious: Math.round(pretentious),
    rewatch: Math.round(rewatch),
    quality: +(quality.toFixed(2)),
    popularity: +(popularity.toFixed(2)),
  };
}

function distributeAttackPoints(totalPoints, moviesArr) {
  const movies = (moviesArr || []).filter(Boolean);
  if (movies.length === 0) return [];
  const scores = movies.map(m => (m.vote_average || 0));
  const sumScores = scores.reduce((a, b) => a + b, 0);
  if (sumScores === 0) {
    const base = Math.floor(totalPoints / movies.length);
    const remainder = totalPoints - base * movies.length;
    return movies.map((m, idx) => base + (idx < remainder ? 1 : 0));
  }
  const rawAlloc = scores.map(s => (s / sumScores) * totalPoints);
  const floored = rawAlloc.map(v => Math.floor(v));
  let remainder = totalPoints - floored.reduce((a, b) => a + b, 0);
  const fractions = rawAlloc.map((v, idx) => ({ idx, frac: v - Math.floor(v) }));
  fractions.sort((a, b) => b.frac - a.frac);
  const final = [...floored];
  for (let i = 0; i < remainder; i++) {
    final[fractions[i].idx] = final[fractions[i].idx] + 1;
  }
  return final;
}

export default function DuelPlay(props) {
  const {
    open,
    challenger: challengerProp,
    opponent: opponentProp,
    challengerSlug,
    opponentSlug,
    playOnMount = false,
  } = props || {};

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(challengerProp || null);
  const [opponent, setOpponent] = useState(opponentProp || null);
  const [error, setError] = useState(null);

  const [revealIndex, setRevealIndex] = useState(-1);
  const [showGoMessage, setShowGoMessage] = useState(false);

  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const mountedRef = useRef(false);
  const bgStartedRef = useRef(false);
  const rootRef = useRef(null);

  // prevent scrolling under modal
  useEffect(() => {
    if (!open) return;
    const prev = { overflow: document.body.style.overflow || "" };
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev.overflow || ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    let cancelled = false;

    async function init() {
      try {
        const [c, o] = await Promise.all([
          challengerProp ? Promise.resolve(challengerProp) : (challengerSlug ? fetchProfileBySlug(challengerSlug) : null),
          opponentProp ? Promise.resolve(opponentProp) : (opponentSlug ? fetchProfileBySlug(opponentSlug) : null),
        ]);

        if (cancelled) return;
        if (!c || !o) {
          setError("Could not load one or both profiles.");
          setLoading(false);
          return;
        }

        c.wins = Number.isFinite(c.wins) ? c.wins : 0;
        c.losses = Number.isFinite(c.losses) ? c.losses : 0;
        c.draws = Number.isFinite(c.draws) ? c.draws : 0;
        c.level = Number.isFinite(c.level) ? c.level : 1;
        c.deck = Array.isArray(c.deck) ? c.deck : [];

        o.wins = Number.isFinite(o.wins) ? o.wins : 0;
        o.losses = Number.isFinite(o.losses) ? o.losses : 0;
        o.draws = Number.isFinite(o.draws) ? o.draws : 0;
        o.level = Number.isFinite(o.level) ? o.level : 1;
        o.deck = Array.isArray(o.deck) ? o.deck : [];

        setChallenger(c);
        setOpponent(o);

        // optional silent audio
        try {
          if (playOnMount && SILENT_AUDIO) {
            const s = new Audio(SILENT_AUDIO);
            s.volume = 0;
            s.play().catch(() => {});
            silentAudioRef.current = s;
          }
        } catch (e) {}

        slotAudioRef.current = new Audio(SLOT_AUDIO);
        slotAudioRef.current.preload = "auto";

        const lastIdxRaw = localStorage.getItem("leaderbox_last_song_idx");
        let idx = 0;
        try {
          const last = Number.isFinite(+lastIdxRaw) ? Number(lastIdxRaw) : -1;
          idx = (last + 1) % BACKGROUND_SONGS.length;
        } catch (e) {
          idx = Math.floor(Math.random() * BACKGROUND_SONGS.length);
        }
        localStorage.setItem("leaderbox_last_song_idx", String(idx));

        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop = true;
        bg.volume = 0.14;
        bg.preload = "auto";
        bgAudioRef.current = bg;

        setTimeout(() => startRevealSequence(c, o), 300);
      } catch (err) {
        console.error("DuelPlay init error", err);
        setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      try { if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.src = ""; } } catch (e) {}
      try { if (slotAudioRef.current) { slotAudioRef.current.pause(); slotAudioRef.current.src = ""; } } catch (e) {}
      try { if (silentAudioRef.current) { silentAudioRef.current.pause(); silentAudioRef.current.src = ""; } } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startRevealSequence(c, o) {
    const topCount = Math.max(4, (o && o.deck ? o.deck.length : 0));
    const bottomCount = Math.max(4, (c && c.deck ? c.deck.length : 0));
    const total = topCount + bottomCount;
    let step = 0;

    const revealTick = () => {
      if (!mountedRef.current) return;
      setRevealIndex(step);
      try {
        if (slotAudioRef.current) {
          const a = slotAudioRef.current.cloneNode(true);
          a.volume = 0.9;
          a.play().then(() => {
            try {
              if (bgAudioRef.current && !bgStartedRef.current) {
                bgAudioRef.current.play().catch(async (err) => {
                  try {
                    bgAudioRef.current.muted = true;
                    await bgAudioRef.current.play();
                    try { bgAudioRef.current.muted = false; } catch (e) {}
                  } catch (e2) {}
                }).finally(() => { bgStartedRef.current = true; });
              }
            } catch (e) {}
          }).catch(() => {
            try {
              if (bgAudioRef.current && !bgStartedRef.current) {
                bgAudioRef.current.play().catch(() => {});
                bgStartedRef.current = true;
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
      step++;
      if (step < total) {
        setTimeout(revealTick, 500);
      } else {
        setTimeout(() => { setShowGoMessage(true); setTimeout(() => setShowGoMessage(false), 1000); }, 250);
      }
    };

    revealTick();
  }

  function computeMoviePointsFromDeck(deckArr) {
    const stats = computeStats(deckArr);
    const moviePointsRaw = stats.pretentious + stats.rewatch + stats.quality + stats.popularity;
    const moviePoints = Math.round(moviePointsRaw);
    const perMovie = distributeAttackPoints(moviePoints, deckArr);
    return { total: moviePoints, perMovie, stats };
  }

  function topVisible(i) {
    if (revealIndex < 0) return false;
    return revealIndex >= i;
  }
  function bottomVisible(i, topCount = 4) {
    if (revealIndex < 0) return false;
    return revealIndex >= (topCount + i);
  }

  if (!open) return null;

  if (loading) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="duel-modal-root"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,                // keep below profile modal (75) so profile modal remains visible
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          background: "rgba(0,0,0,0.98)",
        }}
      >
        <div style={{ margin: "auto", padding: 28, background: "#070708", borderRadius: 12 }}>
          <h2 className="h1-retro">Loading duel…</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="duel-modal-root"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          background: "rgba(0,0,0,0.98)",
        }}
      >
        <div style={{ margin: "auto", padding: 28, background: "#070708", borderRadius: 12 }}>
          <h2 className="h1-retro">Duel error</h2>
          <div style={{ color: "#f66", marginTop: 8 }}>{String(error)}</div>
        </div>
      </div>
    );
  }

  if (!challenger || !opponent) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="duel-modal-root"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          background: "rgba(0,0,0,0.98)",
        }}
      >
        <div style={{ margin: "auto", padding: 28, background: "#070708", borderRadius: 12 }}>
          <h2 className="h1-retro">Missing duel participants</h2>
        </div>
      </div>
    );
  }

  const challengerPoints = computeMoviePointsFromDeck(challenger.deck || []);
  const topCount = Math.max(4, (opponent.deck ? opponent.deck.length : 0));
  const bottomCount = Math.max(4, (challenger.deck ? challenger.deck.length : 0));

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      className="duel-modal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "rgba(0,0,0,0.98)",
        padding: 0,
      }}
    >
      {/* Entire screen covered; center-stage vertically/horizontally */}
      <div
        className="center-stage"
        style={{
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",           // fill whole viewport — no top gap
          boxSizing: "border-box",
          padding: 18,
        }}
      >
        {/* Black bar block sits centered — uses almost full height but scrolls if needed */}
        <div
          className="bar-block"
          aria-hidden
          style={{
            width: "100%",
            maxWidth: 980,
            background: "#101221",
            borderRadius: 12,
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.02)",
            padding: 24,
            boxSizing: "border-box",
            maxHeight: "calc(100vh - 28px)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            className="bar-overlay"
            style={{
              width: "100%",
              color: "var(--white)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              padding: "8px 6px 18px",
              textAlign: "center",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {/* Top header */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 72, height: 72, overflow: "hidden", borderRadius: 10 }}>
                  {opponent.avatar ? (
                    <img src={opponent.avatar} alt={opponent.nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 72, height: 72, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", color: "#ddd" }}>
                      {(opponent.nickname || "U").slice(0, 1)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 18 }}>{opponent.nickname}</div>
                  <div className="small" style={{ color: "#ddd" }}>Level {opponent.level}</div>
                </div>
              </div>
            </div>

            {/* Opponent slots — horizontally forced, scrolls if too wide */}
            <div
              className="slots-row opponent-row"
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                alignItems: "flex-start",
                marginTop: 8,
                overflowX: "auto",
                padding: "6px 8px",
                WebkitOverflowScrolling: "touch",
                // keep in single row
                flexWrap: "nowrap",
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => {
                const m = (opponent.deck && opponent.deck[i]) ? opponent.deck[i] : null;
                const poster = posterFor(m);
                const visible = topVisible(i);
                return (
                  <div key={`opp-slot-${i}`} className={`duel-slot ${visible ? "visible from-top" : "hidden from-top"}`} style={{ flex: "0 0 auto", width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div className="slot-poster-wrap" style={{ width: 92, height: 136, borderRadius: 8, overflow: "hidden", background: "#0d0d10", boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none", transition: "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms" }}>
                      {poster && visible ? (<img src={poster} alt={m?.title || m?.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />) : (<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>)}
                    </div>
                    <div style={{ width: 92, height: 36, textAlign: "center", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", color: "#fff", opacity: visible ? 1 : 0.3, transition: "opacity 300ms" }}>
                      {m ? (m.title || m.name) : ""}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", minHeight: 18 }} />
                  </div>
                );
              })}
            </div>

            {/* Message + challenger slots */}
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
              <div style={{ minHeight: 42 }}>
                {showGoMessage ? (<div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>1st Turn: Go!</div>) : (<div style={{ height: 0 }} />)}
              </div>

              <div style={{ height: 6 }} />

              <div
                className="slots-row challenger-row"
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  alignItems: "flex-start",
                  marginTop: 8,
                  overflowX: "auto",
                  padding: "6px 8px",
                  WebkitOverflowScrolling: "touch",
                  flexWrap: "nowrap", // force horizontal
                }}
              >
                {Array.from({ length: 4 }).map((_, i) => {
                  const m = (challenger.deck && challenger.deck[i]) ? challenger.deck[i] : null;
                  const poster = posterFor(m);
                  const visible = bottomVisible(i, topCount);
                  return (
                    <div key={`you-slot-${i}`} className={`duel-slot ${visible ? "visible from-bottom" : "hidden from-bottom"}`} style={{ flex: "0 0 auto", width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div className="slot-poster-wrap" style={{ width: 92, height: 136, borderRadius: 8, overflow: "hidden", background: "#0d0d10", boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none", transition: "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms" }}>
                        {poster && visible ? (<img src={poster} alt={m?.title || m?.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />) : (<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>)}
                      </div>

                      <div style={{ width: 92, height: 36, textAlign: "center", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", color: "#fff", opacity: visible ? 1 : 0.3, transition: "opacity 300ms" }}>
                        {m ? (m.title || m.name) : ""}
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", minHeight: 18 }}>
                        {visible && (challengerPoints.perMovie[i] !== undefined ? `${challengerPoints.perMovie[i]} atk` : "—")}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div className="small" style={{ color: "#999" }}>Opponent Movie Points</div>
                  <div style={{ fontWeight: 900, color: "var(--accent)" }}>— pts</div>
                </div>

                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.03)" }} />

                <div style={{ textAlign: "center" }}>
                  <div className="small" style={{ color: "#999" }}>Your Movie Points</div>
                  <div style={{ fontWeight: 900, color: "var(--accent)" }}>{challengerPoints.total} pts</div>
                </div>
              </div>

            </div>

            {/* Challenger header bottom */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 8, width: "100%" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 72, height: 72, overflow: "hidden", borderRadius: 10 }}>
                  {challenger.avatar ? (
                    <img src={challenger.avatar} alt={challenger.nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 72, height: 72, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", color: "#ddd" }}>
                      {(challenger.nickname || "U").slice(0, 1)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 18 }}>{challenger.nickname}</div>
                  <div className="small" style={{ color: "#ddd" }}>Level {challenger.level}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        .duel-slot.hidden { opacity: 0.0; transform: translateY(0); }
        .duel-slot.visible { opacity: 1; }
        .duel-slot.from-top { transform-origin: top center; }
        .duel-slot.from-bottom { transform-origin: bottom center; }

        .duel-slot.hidden.from-top .slot-poster-wrap { transform: translateY(-18px) scale(0.98); opacity: 0.0; }
        .duel-slot.visible.from-top .slot-poster-wrap { transform: translateY(0) scale(1); opacity: 1; }
        .duel-slot.hidden.from-bottom .slot-poster-wrap { transform: translateY(18px) scale(0.98); opacity: 0.0; }
        .duel-slot.visible.from-bottom .slot-poster-wrap { transform: translateY(0) scale(1); opacity: 1; }

        .slot-poster-wrap img { transition: transform 240ms ease; display:block; }
        .slot-poster-wrap:hover img { transform: scale(1.02); }

        /* Force horizontal slot layout and smooth scrolling look */
        .slots-row { scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .slots-row::-webkit-scrollbar { height: 8px; }
        .slots-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 6px; }

        @media (max-width: 920px) {
          .center-stage { padding: 8px !important; }
          .bar-block { padding: 12px !important; }
          .slot-poster-wrap { width: 78px !important; height: 116px !important; }
          .duel-slot { width: 94px !important; }
        }

        @media (max-width: 420px) {
          /* make posters slightly smaller on very small devices so row feels better */
          .slot-poster-wrap { width: 70px !important; height: 104px !important; }
          .duel-slot { width: 86px !important; }
        }

        @media (min-width: 1080px) and (min-height: 2340px) {
          .center-stage { max-width: 820px !important; padding: 32px !important; }
        }
      `}</style>
    </div>
  );
}
