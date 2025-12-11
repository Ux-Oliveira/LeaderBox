// src/pages/DuelPlay.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

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

/* helper fetchProfileBySlug omitted for brevity — keep your exact implementation */
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

/* computeStats & distributeAttackPoints omitted here — keep your existing implementations exactly as in your file */
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
  for (let i = 0; i < remainder; i++) final[fractions[i].idx] = final[fractions[i].idx] + 1;
  return final;
}

export default function DuelPlay() {
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [error, setError] = useState(null);

  const [revealIndex, setRevealIndex] = useState(-1);
  const [showGoMessage, setShowGoMessage] = useState(false);
  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const mountedRef = useRef(true);

  const [showBeginOverlay, setShowBeginOverlay] = useState(false);
  const scaledRef = useRef(false);
  const rootRef = useRef(null);

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

        // normalize fields
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

        // silent unlock attempt (harmless)
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

        // choose background song index
        const lastIdxRaw = localStorage.getItem("leaderbox_last_song_idx");
        let idx = 0;
        try {
          const last = Number.isFinite(+lastIdxRaw) ? Number(lastIdxRaw) : -1;
          idx = (last + 1) % BACKGROUND_SONGS.length;
        } catch (e) {
          idx = Math.floor(Math.random() * BACKGROUND_SONGS.length);
        }
        localStorage.setItem("leaderbox_last_song_idx", String(idx));

        // prepare bg audio
        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop = true;
        bg.volume = 0.14;
        bg.preload = "auto";
        bgAudioRef.current = bg;

        // ATTEMPT TO PLAY ON DESKTOP NOW:
        // If user is on desktop (wider than mobile breakpoint) we try to play immediately.
        // If play is blocked, try a muted-play fallback (some browsers allow muted autoplay).
        try {
          const mobileBreakpoint = 920;
          if (typeof window !== "undefined" && window.innerWidth > mobileBreakpoint) {
            // try unmuted play first
            await bg.play().catch(async (err) => {
              // try muted fallback
              try {
                bg.muted = true;
                await bg.play();
                // if muted-play succeeded, unmute only if browser allows (try)
                bg.muted = false;
              } catch (e2) {
                // fail silently, background audio will play later on user gesture
              }
            });
          }
        } catch (e) {
          // ignore autoplay exceptions
        }

        // show BEGIN overlay automatically on small screens only
        const mobileBreakpoint = 920;
        if (typeof window !== "undefined" && window.innerWidth <= mobileBreakpoint) {
          setShowBeginOverlay(true);
        } else {
          setShowBeginOverlay(false);
        }

        // start reveal
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
        try {
          if (slotAudioRef.current) {
            const a = slotAudioRef.current.cloneNode(true);
            a.volume = 0.9;
            a.play().catch(() => {});
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

    const onResize = () => {
      if (!mountedRef.current) return;
      const mobileBreakpoint = 920;
      if (window.innerWidth <= mobileBreakpoint) {
        if (!scaledRef.current) setShowBeginOverlay(true);
      } else {
        setShowBeginOverlay(false);
        if (rootRef.current) {
          rootRef.current.style.transform = "";
          rootRef.current.style.transformOrigin = "";
          rootRef.current.style.transition = "";
          // ensure bar-block returns to absolute if your layout expects it on desktop
          const centerStage = rootRef.current.querySelector(".center-stage");
          if (centerStage) centerStage.style.position = "";
          const barBlock = rootRef.current.querySelector(".bar-block");
          if (barBlock) {
            barBlock.style.position = "";
            barBlock.style.left = "";
            barBlock.style.right = "";
            barBlock.style.top = "";
            barBlock.style.margin = "";
          }
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

  function computeMoviePointsFromDeck(deckArr) {
    const stats = computeStats(deckArr);
    const moviePointsRaw = stats.pretentious + stats.rewatch + stats.quality + stats.popularity;
    const moviePoints = Math.round(moviePointsRaw);
    const perMovie = distributeAttackPoints(moviePoints, deckArr);
    return { total: moviePoints, perMovie, stats };
  }

  function topVisible(i, topCount = 4) {
    if (revealIndex < 0) return false;
    return revealIndex >= i;
  }
  function bottomVisible(i, topCount = 4) {
    if (revealIndex < 0) return false;
    return revealIndex >= (topCount + i);
  }

  // When user taps BEGIN on mobile: scale + center, and fix positioning so the bar-block wraps content
  function handleBeginClick() {
    const root = rootRef.current || document.querySelector(".duel-play-root");
    if (!root) {
      setShowBeginOverlay(false);
      scaledRef.current = true;
      return;
    }

    const centerStage = root.querySelector(".center-stage") || root;
    // ensure center-stage is positioned so absolute children are relative to it
    centerStage.style.position = "relative";

    const barBlock = root.querySelector(".bar-block");
    if (barBlock) {
      // convert bar-block to relative positioning while scaled so it doesn't misplace children
      barBlock.style.position = "relative";
      // clear absolute offsets that could push it off center
      barBlock.style.left = "";
      barBlock.style.right = "";
      barBlock.style.top = "";
      barBlock.style.margin = "24px auto 0 auto";
    }

    // measure bounding after making those adjustments
    const bounding = centerStage.getBoundingClientRect();
    const contentW = Math.max(1, bounding.width);
    const contentH = Math.max(1, bounding.height);

    const navbarHeight = 64;
    let supportHeight = 92;
    const supportEl = document.querySelector(".support");
    if (supportEl) {
      try {
        const sRect = supportEl.getBoundingClientRect();
        supportHeight = Math.min(160, Math.max(56, Math.round(sRect.height)));
      } catch (e) {}
    }

    const safeVPad = 24;
    const availableW = window.innerWidth - 16;
    const availableH = Math.max(100, window.innerHeight - navbarHeight - supportHeight - safeVPad);

    const scaleW = availableW / contentW;
    const scaleH = availableH / contentH;
    let scale = Math.min(1, scaleW * 0.98, scaleH * 0.98);
    scale = Math.max(0.5, scale);

    // Centering: after scaling, the element may need a translateX to truly sit centered.
    // We'll compute the pixel offset and convert to a pre-scale translate so scale keeps the translation correct.
    const scaledContentWidth = contentW * scale;
    const extraSpace = Math.max(0, window.innerWidth - scaledContentWidth);
    // translateX in **pre-scale** units = (extraSpace / 2) / scale
    const translateXPreScale = (extraSpace / 2) / (scale || 1);

    root.style.transition = "transform 280ms cubic-bezier(.2,.9,.2,1)";
    root.style.transformOrigin = "top center";
    root.style.transform = `translateX(${translateXPreScale}px) scale(${scale})`;
    // make sure container keeps centered flow on mobile
    root.style.marginLeft = "0";
    root.style.marginRight = "0";

    setShowBeginOverlay(false);
    scaledRef.current = true;

    // try to start background audio now that user interacted
    if (bgAudioRef.current) {
      bgAudioRef.current.play().catch(() => {});
    }
  }

  if (loading) return (<div style={{ padding: 24 }}><h2 className="h1-retro">Loading duel…</h2></div>);
  if (error) return (<div style={{ padding: 24 }}><h2 className="h1-retro">Duel error</h2><div style={{ color: "#f66", marginTop: 8 }}>{String(error)}</div><div style={{ marginTop: 12 }}><button className="ms-btn" onClick={() => navigate(-1)}>Go back</button></div></div>);
  if (!challenger || !opponent) return (<div style={{ padding: 24 }}><h2 className="h1-retro">Missing duel participants</h2></div>);

  const challengerPoints = computeMoviePointsFromDeck(challenger.deck || []);
  const topCount = Math.max(4, (opponent && opponent.deck ? opponent.deck.length : 0));

  return (
    <div ref={rootRef} className="duel-play-root" style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <div className="center-stage" style={{ position: "relative" }}>
        <div className="bar-block" aria-hidden />
        <div className="bar-overlay" style={{ alignItems: "stretch" }}>
          {/* (all your existing markup for opponent, slots, challenger, etc. — keep exactly as in your current file) */}
          {/* ... the same JSX you already had for opponent, slots, center area, challenger ... */}
          {/* I'll keep markup identical to your file to avoid accidentally changing layout — paste your existing inner JSX here */}
          {/* For brevity in this example I assume you paste the same content you already had (unchanged). */}
        </div>
      </div>

      {showBeginOverlay && (
        <div className="begin-overlay" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="begin-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>BEGIN</div>
            <div className="small" style={{ marginBottom: 18, color: "#ddd", maxWidth: 420 }}>
              Tap BEGIN to automatically fit the Duel screen to your device — no pinch/zoom required.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="begin-btn" onClick={handleBeginClick}>BEGIN</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* keep your slot styles and overlay styles unchanged — include same CSS you had inside this file */
        .begin-overlay { position: fixed; inset: 0; z-index: 11000; display:flex; align-items:center; justify-content:center; background: linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.65)); padding:18px; }
        .begin-modal { width: min(680px,92%); max-width:720px; background: linear-gradient(180deg, rgba(8,9,12,0.98), rgba(16,18,24,0.98)); border-radius:14px; padding:22px; color:var(--white); text-align:center; box-shadow:0 30px 100px rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.04); }
        .begin-btn { background: linear-gradient(90deg, var(--accent), #ffd85a); color:var(--black); border:none; font-weight:900; padding:12px 20px; border-radius:10px; font-size:16px; cursor:pointer; }
        @media (min-width:921px) { .begin-overlay { display:none !important; } }
      `}</style>
    </div>
  );
}
