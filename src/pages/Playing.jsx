// src/pages/Playing.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/playstyle.css"; // ensure this path matches your project

// Audio assets (make sure these files exist in /public/audios)
const BACKGROUND_SONGS = [
  "/audios/city_battle_stars.mp3",
  "/audios/cinematic_battle.mp3",
  "/audios/fun_battle.mp3",
  "/audios/retro_battle.mp3",
];

const SLOT_AUDIO = "/audios/slot.mp3";
const SILENT_AUDIO = "/audios/silent.mp3";
const READYGO_AUDIO = "/audios/readygo.mp3";
const WOOSH_AUDIO = "/audios/woosh.mp3";
const MOVE_AUDIO = "/audios/move.mp3";
const DEMAGE_AUDIO = "/audios/demage.mp3";
const LOSE_AUDIO = "/audios/lose.mp3";

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

/* fetch profile by slug or open_id — mirrors your DuelPlay implementation */
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

// compute stats (same as EditStack)
function computeStats(deckArr) {
  const movies = (deckArr || []).filter(Boolean);
  if (movies.length === 0) return { pretentious: 0, rewatch: 0, quality: 0, popularity: 0 };

  const scores = movies.map(m => (m.vote_average || 0)); // 0..10
  const pops = movies.map(m => (m.popularity || 0)); // unbounded

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

// distribute attack points like EditStack
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
  for (let i = 0; i < remainder; i++) final[fractions[i].idx] += 1;
  return final;
}

// Minimal audio play helper that resolves when audio ends (best-effort)
function playAudioWait(src, fallbackMs = 700) {
  return new Promise(resolve => {
    try {
      const a = new Audio(src);
      a.preload = "auto";
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; try { a.pause(); a.src = ""; } catch (e) {}; resolve(); } };
      a.addEventListener("ended", done);
      a.addEventListener("error", done);
      a.play().catch(() => {
        // play was blocked — fallback to timeout
        setTimeout(done, fallbackMs);
      });
      // safety timeout in case ended doesn't fire
      setTimeout(done, Math.max(800, fallbackMs + 2000));
    } catch (e) {
      setTimeout(resolve, fallbackMs);
    }
  });
}

export default function Playing() {
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();
  const [showGoMessage, setShowGoMessage] = useState(false);

  /* state + refs unchanged */

  // when GO message appears, kick off first-turn animation once
  useEffect(() => {
    if (!showGoMessage) return;
    let cancelled = false;

    async function runFirstTurnSequence() {
      await playAudioWait(READYGO_AUDIO, 900);
      if (cancelled) return;

      /* animation logic unchanged */

      // determine winner (higher points wins)
      const leftPoints = opponentPoints;
      const rightPoints = challengerPoints;
      let winnerIsOpponent = leftPoints >= rightPoints;
      if (leftPoints === rightPoints) winnerIsOpponent = true;

      if (!winnerIsOpponent) {
        // challenger lost
        const rightEl = document.querySelector(".damage-right");
        if (rightEl) {
          rightEl.style.transition = "opacity 220ms, transform 220ms";
          rightEl.style.transform = "scale(1.04)";
          await new Promise(r => setTimeout(r, 160));
          rightEl.style.opacity = "0";
          await new Promise(r => setTimeout(r, 220));
          setDamageRight(0);
        } else {
          setDamageRight(0);
        }

        await playAudioWait(LOSE_AUDIO, 900);
        setShowLossModal(true);
        setTimeout(() => setShowLossModal(false), 7000);

        try {
          await registerResult(opponentSlug, challengerSlug);

          // ✅ ADDED: notify app profiles changed
          window.dispatchEvent(
            new CustomEvent("leaderbox:profile-changed", { detail: { user: null } })
          );
        } catch (e) {
          console.warn("registerResult failed:", e);
        }

        setTimeout(() => navigate("/duel"), 900);
      } else {
        const rightEl = document.querySelector(".damage-right");
        if (rightEl) {
          await new Promise(r => setTimeout(r, 160));
          rightEl.style.transition = "opacity 220ms, transform 220ms";
          rightEl.style.transform = "scale(1.04)";
          await new Promise(r => setTimeout(r, 160));
          rightEl.style.opacity = "0";
          await new Promise(r => setTimeout(r, 220));
          setDamageRight(0);
        } else {
          setDamageRight(0);
        }

        await playAudioWait(LOSE_AUDIO, 900);
        setShowLossModal(true);
        setTimeout(() => setShowLossModal(false), 7000);

        try {
          await registerResult(opponentSlug, challengerSlug);

          // ✅ ADDED: notify app profiles changed
          window.dispatchEvent(
            new CustomEvent("leaderbox:profile-changed", { detail: { user: null } })
          );
        } catch (e) {
          console.warn("registerResult failed:", e);
        }

        setTimeout(() => navigate("/duel"), 900);
      }

      setTimeout(() => setShowDamageCalc(false), 1400);
    }

    runFirstTurnSequence();
    return () => { cancelled = true; };
  }, [showGoMessage, opponentPoints, challengerPoints, opponentSlug, challengerSlug, navigate]);

  // best-effort result registration — tries a few plausible endpoints
  async function registerResult(winnerId, loserId, isDraw = false) {
    try {
      const wRes = await fetch(`/api/profile?open_id=${encodeURIComponent(winnerId)}`, {
        credentials: "same-origin"
      });
      const wJson = await wRes.json();
      const winner = wJson.profile || wJson;

      const lRes = await fetch(`/api/profile?open_id=${encodeURIComponent(loserId)}`, {
        credentials: "same-origin"
      });
      const lJson = await lRes.json();
      const loser = lJson.profile || lJson;

      if (!winner || !loser) return false;

      if (isDraw) {
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ open_id: winner.open_id, draws: (winner.draws || 0) + 1 })
        });

        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ open_id: loser.open_id, draws: (loser.draws || 0) + 1 })
        });

        return true;
      }

      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ open_id: winner.open_id, wins: (winner.wins || 0) + 1 })
      });

      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ open_id: loser.open_id, losses: (loser.losses || 0) + 1 })
      });

      return true;
    } catch (err) {
      console.error("registerResult failed:", err);
      return false;
    }
  }

  if (loading || !challenger || !opponent) {
    return <div className="loading">Loading duel…</div>;
  }
  return (
    <div className="playing-root">
      {/* Inline minimal CSS for the animations and overlays that are specific to first-turn */}
      <style>{`
        /* transient center damage calc */
        .damage-calc {
          position: absolute;
          left: 50%;
          top: 48%;
          transform: translate(-50%, -50%);
          background: transparent;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 120;
          font-weight: 900;
          font-size: 22px;
          pointer-events: none;
          text-shadow: 0 6px 18px rgba(0,0,0,0.6);
        }
        .damage-calc .damage-left, .damage-calc .damage-right {
          min-width: 56px;
          text-align: center;
          display: inline-block;
        }
        .damage-calc .pipe { opacity: 0.9; color: #ddd; }
        /* loss modal */
        .loss-modal {
          position: fixed;
          inset: 0;
          display:flex;
          align-items:center;
          justify-content:center;
          z-index: 200;
          background: rgba(0,0,0,0.45);
          pointer-events: none;
        }
        .loss-modal .card {
          background: transparent;
          border-radius: 12px;
          padding: 12px;
          box-shadow: none;
        }
        .loss-modal img { width: 240px; height: 240px; object-fit: contain; display:block; }
      `}</style>

      {/* Opponent (top) */}
      <div className="player-top" ref={topStackRef}>
        <div className="player-info">
          <img src={opponent.avatar || ""} alt={opponent.nickname} className="pfp"/>
          <div className="username-level">
            <div className="username">{opponent.nickname}</div>
            <div className="level">Level {opponent.level}</div>
          </div>
        </div>

        <div
          className="movie-slots"
          ref={el => {
            // keep ref to the container if needed; not used directly
          }}
        >
          {(opponent.deck || []).map((m, i) => {
            const poster = posterFor(m);
            const visible = i <= revealIndexTop;
            return (
              <div key={i} className="slot-wrap" ref={el => { topSlotRefs.current[i] = el; }}>
                <div className={`slot ${visible ? "visible from-top" : "hidden from-top"}`}>
                  {poster ? <img src={poster} alt={m.title || m.name} /> : <div className="empty-slot">—</div>}
                </div>
                <div className="atk-badge placeholder" aria-hidden="true"> </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="spacer" />

      {/* Challenger (bottom) */}
      <div className="player-bottom" ref={bottomStackRef}>
        <div className="movie-slots">
          {(challenger.deck || []).map((m, i) => {
            const poster = posterFor(m);
            const visible = i <= revealIndexBottom;
            const atkLabel = challengerPerMovie && challengerPerMovie[i] !== undefined ? `${challengerPerMovie[i]} atk` : "—";
            return (
              <div key={i} className="slot-wrap" ref={el => { bottomSlotRefs.current[i] = el; }}>
                <div className={`slot ${visible ? "visible from-bottom" : "hidden from-bottom"}`}>
                  {poster ? <img src={poster} alt={m.title || m.name} /> : <div className="empty-slot">—</div>}
                </div>
                <div className="atk-badge">{visible ? atkLabel : " "}</div>
              </div>
            );
          })}
        </div>

        <div className="player-info-bottom">
          <img src={challenger.avatar || ""} alt={challenger.nickname} className="pfp no-frame"/>
          <div className="username-level">
            <div className="username">{challenger.nickname}</div>
            <div className="level">Level {challenger.level}</div>
            <div className="points">{challengerPoints} pts</div>
          </div>
        </div>
      </div>

      {/* controls: only Rules button centered */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18, zIndex: 30 }}>
        <button
          type="button"
          className="yellow-btn"
          onClick={() => navigate("/rules")}
          aria-label="Brush up on the rules"
        >
          Brush up on the rules
        </button>
      </div>

      {/* GO message */}
      {showGoMessage && <div className="go-message">1st Turn: GO!</div>}

      {/* Damage calculation UI */}
      {showDamageCalc && (
        <div className="damage-calc" role="status" aria-live="polite">
          <div className="damage-left">{damageLeft}</div>
          <div className="pipe">|</div>
          <div className="damage-right">{damageRight}</div>
        </div>
      )}

      {/* Loss modal */}
      {showLossModal && (
        <div className="loss-modal" role="dialog" aria-modal="true">
          <div className="card">
            {/* Ensure loss.gif exists at /public/loss.gif */}
            <img src="/loss.gif" alt="You lost" />
          </div>
        </div>
      )}
    </div>
  );
}
