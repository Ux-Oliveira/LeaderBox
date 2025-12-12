// src/pages/DuelPlay.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const BACKGROUND_SONGS = [
  "/audios/city_battle_stars.mp3",
  "/audios/cinematic_battle.mp3",
  "/audios/fun_battle.mp3",
  "/audios/retro_battle.mp3",
];

const SLOT_AUDIO = "/audios/slot.mp3";
const SILENT_AUDIO = "/audios/silent.mp3"; // fake audio to initiate audio playing

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

/* small helper to fetch profile by slug or open_id */
async function fetchProfileBySlug(slug) {
  if (!slug) return null;
  // try nickname first
  try {
    const byNick = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byNick.ok) {
      const txt = await byNick.text();
      try {
        const json = JSON.parse(txt);
        const profile = json.profile || json;
        return profile;
      } catch (e) {}
    }
  } catch (e) {}
  // fallback by open_id
  try {
    const byId = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byId.ok) {
      const txt = await byId.text();
      try {
        const json = JSON.parse(txt);
        const profile = json.profile || json;
        return profile;
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

/* compute stats using same algorithm as EditStack */
function computeStats(deckArr) {
  const movies = (deckArr || []).filter(Boolean);
  if (movies.length === 0) return { pretentious: 0, rewatch: 0, quality: 0, popularity: 0 };

  const scores = movies.map(m => (m.vote_average || 0)); // 0..10
  const pops = movies.map(m => (m.popularity || 0)); // unbounded

  // Normalize popularity within this deck to 0..1
  const minPop = Math.min(...pops);
  const maxPop = Math.max(...pops);
  const normPops = pops.map(p => (maxPop === minPop ? 0.5 : (p - minPop) / (maxPop - minPop)));

  // Normalize scores 0..1 (TMDB vote_average ~0..10)
  const normScores = scores.map(s => Math.min(1, Math.max(0, s / 10)));

  // Quality = average score (0..10)
  const quality = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Popularity average (raw)
  const popularity = pops.reduce((a, b) => a + b, 0) / pops.length;

  // Pretentiousness: high score AND low popularity -> pretentious
  const pretArr = normScores.map((ns, idx) => ns * (1 - normPops[idx]));
  const pretentious = (pretArr.reduce((a, b) => a + b, 0) / pretArr.length) * 100; // 0..100

  // Rewatchability: high score * high popularity
  const rewatchArr = normScores.map((ns, idx) => ns * normPops[idx]);
  const rewatch = (rewatchArr.reduce((a, b) => a + b, 0) / rewatchArr.length) * 100;

  return {
    pretentious: Math.round(pretentious),
    rewatch: Math.round(rewatch),
    quality: +(quality.toFixed(2)),
    popularity: +(popularity.toFixed(2)),
  };
}

/* distribute attack points like EditStack */
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

export default function DuelPlay() {
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [error, setError] = useState(null);

  // animation and audio state
  const [revealIndex, setRevealIndex] = useState(-1); // -1 = not started, 0..n-1 reveals
  const [showGoMessage, setShowGoMessage] = useState(false);
  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const mountedRef = useRef(true);
  const bgStartedRef = useRef(false);

  // BEGIN overlay state (mobile only)
  const [showBeginOverlay, setShowBeginOverlay] = useState(false);
  const scaledRef = useRef(false); // whether we've applied the auto-scale
  const rootRef = useRef(null); // root container to transform

  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [c, o] = await Promise.all([
          fetchProfileBySlug(challengerSlug),
          fetchProfileBySlug(opponentSlug),
        ]);
        if (!mountedRef.current) return;

        if (!c || !o) {
          setError("Could not load one or both profiles.");
          setLoading(false);
          return;
        }

        // normalize
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

        // silent unlock attempt (harmless and intentionally kept)
        try {
          if (SILENT_AUDIO) {
            const s = new Audio(SILENT_AUDIO);
            s.volume = 0;
            s.play().catch(() => {});
            silentAudioRef.current = s;
          }
        } catch (e) {}

        // slot audio preload
        slotAudioRef.current = new Audio(SLOT_AUDIO);
        slotAudioRef.current.preload = "auto";

        // choose background song index (rotate using localStorage)
        const lastIdxRaw = localStorage.getItem("leaderbox_last_song_idx");
        let idx = 0;
        try {
          const last = Number.isFinite(+lastIdxRaw) ? Number(lastIdxRaw) : -1;
          idx = (last + 1) % BACKGROUND_SONGS.length;
        } catch (e) {
          idx = Math.floor(Math.random() * BACKGROUND_SONGS.length);
        }
        localStorage.setItem("leaderbox_last_song_idx", String(idx));

        // prepare bg audio but DO NOT auto-play — we'll keep silent audio playing; bg will be played on user gesture if needed
        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop = true;
        bg.volume = 0.14;
        bg.preload = "auto";
        bgAudioRef.current = bg;

        // show BEGIN overlay automatically on small screens only
        const mobileBreakpoint = 920; // same threshold you've used
        if (typeof window !== "undefined" && window.innerWidth <= mobileBreakpoint) {
          setShowBeginOverlay(true);
        } else {
          setShowBeginOverlay(false);
        }

        // start reveal sequence shortly after render
        setTimeout(() => startRevealSequence(c, o), 400);
      } catch (err) {
        console.error("duel play init error", err);
        if (mountedRef.current) setError(String(err));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    function startRevealSequence(c, o) {
      const topCount = Math.max(4, (o && o.deck ? o.deck.length : 0));
      const bottomCount = Math.max(4, (c && c.deck ? c.deck.length : 0));
      const total = topCount + bottomCount;
      let step = 0;

      const revealTick = () => {
        if (!mountedRef.current) return;
        setRevealIndex(step);
        // play slot audio clone for each reveal
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
                    } catch (e2) {
                      // ignore
                    }
                  }).finally(() => {
                    bgStartedRef.current = true;
                  });
                }
              } catch (e) {
                // ignore bg play errors
              }
            }).catch(() => {
              // slot play blocked — still try bg as best effort
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
          setTimeout(() => {
            setShowGoMessage(true);
            setTimeout(() => setShowGoMessage(false), 1000);
          }, 250);
        }
      };

      revealTick();
    }

    init();

    // when resizing on mobile, if user hasn't tapped BEGIN, keep overlay visible
    const onResize = () => {
      if (!mountedRef.current) return;
      const mobileBreakpoint = 920;
      if (window.innerWidth <= mobileBreakpoint) {
        if (!scaledRef.current) setShowBeginOverlay(true);
      } else {
        setShowBeginOverlay(false);
        // clear transform when leaving mobile
        if (rootRef.current) {
          rootRef.current.style.transform = "";
          rootRef.current.style.transformOrigin = "";
        }
        scaledRef.current = false;
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("resize", onResize);
      try { if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.src = ""; } } catch (e) {}
      try { if (slotAudioRef.current) { slotAudioRef.current.pause(); slotAudioRef.current.src = ""; } } catch (e) {}
      try { if (silentAudioRef.current) { silentAudioRef.current.pause(); silentAudioRef.current.src = ""; } } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengerSlug, opponentSlug]);

  // compute accurate movie points using editstack formulas
  function computeMoviePointsFromDeck(deckArr) {
    const stats = computeStats(deckArr);
    const moviePointsRaw = stats.pretentious + stats.rewatch + stats.quality + stats.popularity;
    const moviePoints = Math.round(moviePointsRaw);
    const perMovie = distributeAttackPoints(moviePoints, deckArr);
    return { total: moviePoints, perMovie, stats };
  }

  // helper mapping for reveal
  function topVisible(i, topCount = 4) {
    if (revealIndex < 0) return false;
    return revealIndex >= i;
  }
  function bottomVisible(i, topCount = 4) {
    if (revealIndex < 0) return false;
    return revealIndex >= (topCount + i);
  }

  // Called when mobile user taps BEGIN: compute a scale that fits both width and height
  function handleBeginClick() {
    // apply transform to the duel-play-root (rootRef)
    const root = rootRef.current || document.querySelector(".duel-play-root");
    if (!root) {
      setShowBeginOverlay(false);
      scaledRef.current = true;
      return;
    }

    // ensure center-stage and bar-block are positioned so measurements are consistent
    const centerStage = root.querySelector(".center-stage") || root;
    if (centerStage) centerStage.style.position = "relative";
    const barBlock = root.querySelector(".bar-block");
    if (barBlock) {
      barBlock.style.position = "relative";
      barBlock.style.left = "";
      barBlock.style.right = "";
      barBlock.style.top = "";
      barBlock.style.margin = "24px auto 0 auto";
    }

    // measure natural sizes
    const bounding = centerStage.getBoundingClientRect();
    const contentW = Math.max(1, bounding.width);
    const contentH = Math.max(1, bounding.height);

    // compute available viewport space (account for navbar + some safe margins + support footer)
    const navbarHeight = 64;
    let supportHeight = 92;
    const supportEl = document.querySelector(".support");
    if (supportEl) {
      try {
        const sRect = supportEl.getBoundingClientRect();
        supportHeight = Math.min(160, Math.max(56, Math.round(sRect.height)));
      } catch (e) {}
    }

    const safeVPad = 24; // breathing room
    const availableW = window.innerWidth - 16; // small horizontal margin
    const availableH = Math.max(100, window.innerHeight - navbarHeight - supportHeight - safeVPad);

    // compute scale that fits both axis
    const scaleW = availableW / contentW;
    const scaleH = availableH / contentH;
    // use 0.98 multiplier so things don't touch edges
    let scale = Math.min(1, scaleW * 0.98, scaleH * 0.98);
    // clamp to 0.5 min
    scale = Math.max(0.5, scale);

    // Centering: after scaling, the element may need a translateX to truly sit centered.
    // We'll compute the pixel offset and convert to a pre-scale translate so scale keeps the translation correct.
    const scaledContentWidth = contentW * scale;
    const extraSpace = Math.max(0, window.innerWidth - scaledContentWidth);
    // translateX in **pre-scale** units = (extraSpace / 2) / scale
    const translateXPreScale = (extraSpace / 2) / (scale || 1);

    // apply transform with translateX pre-scale so after scale it is centered properly
    root.style.transition = "transform 280ms cubic-bezier(.2,.9,.2,1)";
    root.style.transformOrigin = "top center";
    root.style.transform = `translateX(${translateXPreScale}px) scale(${scale})`;

    // hide overlay
    setShowBeginOverlay(false);
    scaledRef.current = true;

    // attempt to play background audio (silent already played); optional
    if (bgAudioRef.current && !bgStartedRef.current) {
      bgAudioRef.current.play().catch(async (err) => {
        try {
          bgAudioRef.current.muted = true;
          await bgAudioRef.current.play();
          try { bgAudioRef.current.muted = false; } catch (e) {}
        } catch (e2) {
          // unable to start bg audio
        }
      }).finally(() => {
        bgStartedRef.current = true;
      });
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2 className="h1-retro">Loading duel…</h2>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2 className="h1-retro">Duel error</h2>
        <div style={{ color: "#f66", marginTop: 8 }}>{String(error)}</div>
        <div style={{ marginTop: 12 }}>
          <button className="ms-btn" onClick={() => navigate(-1)}>Go back</button>
        </div>
      </div>
    );
  }
  if (!challenger || !opponent) {
    return (
      <div style={{ padding: 24 }}>
        <h2 className="h1-retro">Missing duel participants</h2>
      </div>
    );
  }

  // compute challenger points (accurate)
  const challengerPoints = computeMoviePointsFromDeck(challenger.deck || []);

  const topCount = Math.max(4, (opponent && opponent.deck ? opponent.deck.length : 0));
  const bottomCount = Math.max(4, (challenger && challenger.deck ? challenger.deck.length : 0));

  return (
    <div
      ref={rootRef}
      className="duel-play-root"
      style={{ padding: 24, display: "flex", justifyContent: "center", position: "relative" }}
    >
      {/* BEGIN overlay for mobile */}
      {showBeginOverlay && (
        <div
          className="duel-begin-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, rgba(2,2,6,0.85), rgba(2,2,6,0.9))",
            padding: 24,
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, textAlign: "center", color: "#fff" }}>
            <h2 className="h1-retro" style={{ marginBottom: 8 }}>Prepare for battle</h2>
            <p style={{ color: "rgba(255,255,255,0.85)", marginBottom: 18 }}>Tap BEGIN to fit this duel nicely on your device.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={handleBeginClick}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  background: "linear-gradient(90deg,#FDEE69,#ffd85a)",
                  color: "#111",
                  fontWeight: 900,
                  border: 0,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                BEGIN
              </button>
              <button
                onClick={() => { setShowBeginOverlay(false); scaledRef.current = true; }}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer"
                }}
              >
                Skip
              </button>
            </div>
            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>You can always use pinch-to-zoom in your browser if needed.</div>
          </div>
        </div>
      )}

      <div
        className="center-stage"
        style={{
          width: "100%",
          maxWidth: "720px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          margin: "0 auto",
        }}
      >
        <div className="bar-block" aria-hidden />

        <div className="bar-overlay" style={{ alignItems: "stretch", width: "100%" }}>
          {/* Top — Opponent header */}
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

          {/* Opponent slots (top row) */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, overflowX: "auto" }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const m = (opponent.deck && opponent.deck[i]) ? opponent.deck[i] : null;
              const poster = posterFor(m);
              const visible = topVisible(i, topCount);
              return (
                <div
                  key={`opp-slot-${i}`}
                  className={`duel-slot ${visible ? "visible from-top" : "hidden from-top"}`}
                  style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                >
                  <div
                    className="slot-poster-wrap"
                    style={{
                      width: 92,
                      height: 136,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#0d0d10",
                      boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none",
                      transition: "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms"
                    }}
                  >
                    {poster && visible ? (
                      <img src={poster} alt={m?.title || m?.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>
                    )}
                  </div>

                  <div style={{ width: 92, height: 36, textAlign: "center", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", color: "#fff", opacity: visible ? 1 : 0.3, transition: "opacity 300ms" }}>
                    {m ? (m.title || m.name) : ""}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", minHeight: 18 }}>
                    { /* intentionally hidden for opponent */ }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center area: message + challenger slots */}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {/* Message area (appears after reveal) */}
            <div style={{ minHeight: 42 }}>
              {showGoMessage ? (
                <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>
                  1st Turn: Go!
                </div>
              ) : (
                <div style={{ height: 0 }} />
              )}
            </div>

            <div style={{ height: 6 }} />

            {/* Challenger slots (bottom row) */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, overflowX: "auto" }}>
              {Array.from({ length: 4 }).map((_, i) => {
                const m = (challenger.deck && challenger.deck[i]) ? challenger.deck[i] : null;
                const poster = posterFor(m);
                const visible = bottomVisible(i, topCount);
                return (
                  <div
                    key={`you-slot-${i}`}
                    className={`duel-slot ${visible ? "visible from-bottom" : "hidden from-bottom"}`}
                    style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    <div
                      className="slot-poster-wrap"
                      style={{
                        width: 92,
                        height: 136,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#0d0d10",
                        boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none",
                        transition: "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms"
                      }}
                    >
                      {poster && visible ? (
                        <img src={poster} alt={m?.title || m?.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>
                      )}
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

            {/* Movie Points totals (only show challenger's points) */}
            <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div className="small" style={{ color: "#999" }}>Opponent Movie Points</div>
                {/* intentionally hidden value */}
                <div style={{ fontWeight: 900, color: "var(--accent)" }}>— pts</div>
              </div>

              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.03)" }} />

              <div style={{ textAlign: "center" }}>
                <div className="small" style={{ color: "#999" }}>Your Movie Points</div>
                <div style={{ fontWeight: 900, color: "var(--accent)" }}>{challengerPoints.total} pts</div>
              </div>
            </div>

            <div style={{ height: 8 }} />
          </div>

          {/* Bottom: Challenger header (mirrors top) */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
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

    <style>{`
/* ========================= */
/*   Duel Play animations    */
/* ========================= */
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

/* ========================= */
/*   DESKTOP DEFAULT         */
/* ========================= */
.center-stage {
  width: 100%;
  max-width: 1100px;
  position: relative;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
}

/* ❗ Desktop: Make block MUCH taller so pfp + level stay inside */
.bar-block {
  width: 100%;
  height: 780px;                     /* ⬅ increased from 690px */
  background: #101221;
  border-radius: 14px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.02);
  position: absolute;
  top: 0;                             /* ⬅ raise upward so more room below */
  left: 0;
  right: 0;
  z-index: 10;
}

/* Protect overlay */
.bar-overlay {
  position: relative;
  width: calc(100% - 80px);
  margin: 0 40px;
  z-index: 40;
  color: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 22px 10px 28px;           /* ⬅ a bit more breathing */
  text-align: center;
}

/* ========================= */
/*   MOBILE FIXES            */
/* ========================= */
@media (max-width: 920px) {
  .duel-play-root { padding-left: 10px !important; padding-right: 10px !important; }

  .center-stage {
    width: 100% !important;
    max-width: 100% !important;
    padding: 10px !important;
    box-sizing: border-box !important;
    transform: translateX(-650px) scale(0.98) !important;
    transform-origin: top center;
  }

  .here {
  
  }

  /* ❗ MOBILE FIX: Make it MUCH TALLER and lower from top */
  /* NEW */
.bar-block {
    transform-origin: center;
    transform: scaleX(2.0) scaleY(1.0); /* 8% wider */
    min-height: 780px;
    position: relative !important;
    left: auto !important;
    right: auto !important;
    top: auto !important;
    margin: 10px auto 0 !important;    /* ⬅ adds top space */
    width: 38px) !important;
    max-width: 730px !important;
    height: auto !important;
    min-height: 700px !important;      /* ⬅ BIG FIX: more vertical space */
    padding: 36px !important;          /* ⬅ more padding so card looks full */
    overflow: visible !important;
  }

/* mobile variant: still bigger but won't overflow viewport */
@media (max-width: 920px) {
  .bar-block {
    width: calc(100% + 40px); /* slightly wider than container on mobile */
    margin: 0 -20px;          /* center the wider bar */
    min-height: 600px;        /* mobile needs more vertical space (your previous value) */
    padding: 22px;            /* keep interior padding */
  }
}

  .bar-overlay {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 18px !important;          /* ⬅ increased */
    overflow: visible !important;
    align-items: center !important;
    transform: translateY(-720px) scale(0.98) !important;
  }

  .bar-overlay > div[style*="display: flex"] {
    justify-content: center !important;
    width: 100% !important;
    max-width: 640px;
    margin: 0 auto;
  }

  /* Posters */
  .slot-poster-wrap { width: 78px !important; height: 116px !important; }
  .duel-slot { width: 94px !important; }
}

/* ========================= */
/*   LARGE-TALL SCREENS      */
/* ========================= */
@media (min-width: 1080px) && (min-height: 2340px) {
  .center-stage { max-width: 820px !important; padding: 32px !important; }
  .bar-block { max-height: calc(100vh - 160px) !important; }    /* ⬅ deeper */
  .bar-overlay { max-height: calc(100vh - 200px) !important; overflow: auto !important; }
}

/* ========================= */
/*   DUEL-OPEN TWEAKS        */
/* ========================= */
body.duel-open .center-stage { transform: translateX(1px) !important; }

body.duel-open .bar-overlay > div,
body.duel-open .bar-overlay .duel-slot,
body.duel-open .bar-overlay .slot-poster-wrap {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
`}</style>

    </div>
  );
}
