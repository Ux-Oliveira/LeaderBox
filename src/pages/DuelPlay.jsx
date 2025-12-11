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

async function fetchProfileBySlug(slug) {
  if (!slug) return null;
  try {
    const byNick = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byNick.ok) {
      const txt = await byNick.text();
      try {
        const json = JSON.parse(txt);
        const profile = json.profile || json;
        return profile;
      } catch {}
    }
  } catch {}
  try {
    const byId = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byId.ok) {
      const txt = await byId.text();
      try {
        const json = JSON.parse(txt);
        const profile = json.profile || json;
        return profile;
      } catch {}
    }
  } catch {}
  return null;
}

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
    final[fractions[i].idx] += 1;
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
  const [revealIndex, setRevealIndex] = useState(-1);
  const [showGoMessage, setShowGoMessage] = useState(false);
  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const mountedRef = useRef(true);
  const bgStartedRef = useRef(false);

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

        if (SILENT_AUDIO) {
          const s = new Audio(SILENT_AUDIO);
          s.volume = 0;
          s.play().catch(() => {});
          silentAudioRef.current = s;
        }

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

        const mobileBreakpoint = 920;
        if (typeof window !== "undefined" && window.innerWidth <= mobileBreakpoint) {
          setShowBeginOverlay(true);
        } else {
          setShowBeginOverlay(false);
        }

        setTimeout(() => startRevealSequence(c, o), 400);
      } catch (err) {
        console.error("duel play init error", err);
        if (mountedRef.current) setError(String(err));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    function startRevealSequence(c, o) {
      const topCount = Math.max(4, (o?.deck?.length || 0));
      const bottomCount = Math.max(4, (c?.deck?.length || 0));
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
              if (bgAudioRef.current && !bgStartedRef.current) {
                bgAudioRef.current.play().catch(async (err) => {
                  try {
                    bgAudioRef.current.muted = true;
                    await bgAudioRef.current.play();
                    bgAudioRef.current.muted = false;
                  } catch {}
                }).finally(() => { bgStartedRef.current = true; });
              }
            }).catch(() => {
              if (bgAudioRef.current && !bgStartedRef.current) {
                bgAudioRef.current.play().catch(() => {});
                bgStartedRef.current = true;
              }
            });
          }
        } catch {}
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
        }
        scaledRef.current = false;
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("resize", onResize);
      try { if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.src = ""; } } catch {}
      try { if (slotAudioRef.current) { slotAudioRef.current.pause(); slotAudioRef.current.src = ""; } } catch {}
      try { if (silentAudioRef.current) { silentAudioRef.current.pause(); silentAudioRef.current.src = ""; } } catch {}
    };
  }, [challengerSlug, opponentSlug]);

  function computeMoviePointsFromDeck(deckArr) {
    const stats = computeStats(deckArr);
    const moviePointsRaw = stats.pretentious + stats.rewatch + stats.quality + stats.popularity;
    const moviePoints = Math.round(moviePointsRaw);
    const perMovie = distributeAttackPoints(moviePoints, deckArr);
    return { total: moviePoints, perMovie, stats };
  }

  function topVisible(i, topCount = 4) {
    return revealIndex >= i;
  }
  function bottomVisible(i, topCount = 4) {
    return revealIndex >= (topCount + i);
  }

  function handleBeginClick() {
    const root = rootRef.current || document.querySelector(".duel-play-root");
    if (!root) {
      setShowBeginOverlay(false);
      scaledRef.current = true;
      return;
    }

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
      } catch {}
    }
    const safeVPad = 24;
    const availableW = window.innerWidth - 16;
    const availableH = Math.max(100, window.innerHeight - navbarHeight - supportHeight - safeVPad);

    let scale = Math.min(1, availableW / contentW * 0.98, availableH / contentH * 0.98);
    scale = Math.max(0.5, scale);

    const scaledContentWidth = contentW * scale;
    const scaledContentHeight = contentH * scale;
    const extraSpaceX = Math.max(0, window.innerWidth - scaledContentWidth);
    const extraSpaceY = Math.max(0, window.innerHeight - navbarHeight - supportHeight - safeVPad - scaledContentHeight);

    const translateXPreScale = extraSpaceX / 2 / scale;
    const translateYPreScale = extraSpaceY / 2 / scale;

    root.style.transition = "transform 280ms cubic-bezier(.2,.9,.2,1)";
    root.style.transformOrigin = "top center";
    root.style.transform = `translate(${translateXPreScale}px, ${translateYPreScale}px) scale(${scale})`;

    setShowBeginOverlay(false);
    scaledRef.current = true;

    if (bgAudioRef.current && !bgStartedRef.current) {
      bgAudioRef.current.play().catch(async () => {
        try {
          bgAudioRef.current.muted = true;
          await bgAudioRef.current.play();
          bgAudioRef.current.muted = false;
        } catch {}
      }).finally(() => { bgStartedRef.current = true; });
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

  const challengerPoints = computeMoviePointsFromDeck(challenger.deck || []);
  const topCount = Math.max(4, opponent?.deck?.length || 0);
  const bottomCount = Math.max(4, challenger?.deck?.length || 0);

  return (
    <div ref={rootRef} className="duel-play-root" style={{ padding: 24, display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
      {showBeginOverlay && (
        <div
          onClick={handleBeginClick}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            color: "#fff",
            fontSize: "6vw",
            cursor: "pointer",
            fontFamily: "monospace",
            userSelect: "none",
          }}
        >
          BEGIN
        </div>
      )}

      <div className="center-stage" style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
        <h2 className="h1-retro">{challenger.nickname} vs {opponent.nickname}</h2>
        <div className="deck-display" style={{ display: "flex", gap: 12 }}>
          <div className="opponent-deck" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(opponent.deck || []).map((movie, i) => (
              <img
                key={`top-${i}`}
                src={posterFor(movie) || "/images/placeholder.png"}
                alt={movie.title || "Movie"}
                style={{ width: 80, height: 120, opacity: topVisible(i) ? 1 : 0.15, transition: "opacity 0.3s" }}
              />
            ))}
          </div>
          <div className="challenger-deck" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(challenger.deck || []).map((movie, i) => (
              <img
                key={`bottom-${i}`}
                src={posterFor(movie) || "/images/placeholder.png"}
                alt={movie.title || "Movie"}
                style={{ width: 80, height: 120, opacity: bottomVisible(i) ? 1 : 0.15, transition: "opacity 0.3s" }}
              />
            ))}
          </div>
        </div>
        {showGoMessage && <div style={{ color: "#0f0", fontSize: 32, marginTop: 12 }}>GO!</div>}
      </div>
    </div>
  );
}
