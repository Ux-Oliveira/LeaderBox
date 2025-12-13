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

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [revealIndexTop, setRevealIndexTop] = useState(-1);
  const [revealIndexBottom, setRevealIndexBottom] = useState(-1);
  const [showGoMessage, setShowGoMessage] = useState(false);

  // refs for stacks and slots
  const topStackRef = useRef(null);
  const bottomStackRef = useRef(null);
  const topSlotRefs = useRef([]);
  const bottomSlotRefs = useRef([]);
  const [showDamageCalc, setShowDamageCalc] = useState(false);
  const [damageLeft, setDamageLeft] = useState(0);
  const [damageRight, setDamageRight] = useState(0);
  const [showLossModal, setShowLossModal] = useState(false);
  const [winnerOpenId, setWinnerOpenId] = useState(null);
  const [loserOpenId, setLoserOpenId] = useState(null);

  // preload audios (kept for reuse)
  const bgAudioRef = useRef(null);
  const slotAudioRef = useRef(null);
  const readyGoRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      try {
        const [c, o] = await Promise.all([
          fetchProfileBySlug(challengerSlug),
          fetchProfileBySlug(opponentSlug),
        ]);

        if (!mounted) return;

        if (!c || !o) {
          alert("Error loading duel users");
          navigate(-1);
          return;
        }

        // normalize minimal fields so UI won't break
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

        // silent audio to unlock
        try {
          const s = new Audio(SILENT_AUDIO);
          s.volume = 0;
          s.play().catch(() => {});
        } catch (e) {}

        // slot audio preload
        slotAudioRef.current = new Audio(SLOT_AUDIO);
        slotAudioRef.current.preload = "auto";

        // readygo preload
        readyGoRef.current = new Audio(READYGO_AUDIO);

        // background audio rotate
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
        setTimeout(() => {
          bgAudioRef.current && bgAudioRef.current.play().catch(() => {});
        }, 150);

        // reveal sequence then show GO
        startRevealSequence(o.deck || [], c.deck || []);
      } catch (err) {
        console.error("Playing init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    function startRevealSequence(topDeck, bottomDeck) {
      let topStep = 0;
      const topTick = () => {
        if (topStep < topDeck.length) {
          setRevealIndexTop(topStep);
          try { slotAudioRef.current && slotAudioRef.current.cloneNode(true).play().catch(() => {}); } catch (e) {}
          topStep++;
          setTimeout(topTick, 360);
        } else {
          let bottomStep = 0;
          const bottomTick = () => {
            if (bottomStep < bottomDeck.length) {
              setRevealIndexBottom(bottomStep);
              try { slotAudioRef.current && slotAudioRef.current.cloneNode(true).play().catch(() => {}); } catch (e) {}
              bottomStep++;
              setTimeout(bottomTick, 360);
            } else {
              // GO!
              setShowGoMessage(true);
            }
          };
          bottomTick();
        }
      };
      topTick();
    }

    init();

    return () => {
      mounted = false;
      try { if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.src = ""; } } catch (e) {}
      try { if (slotAudioRef.current) { slotAudioRef.current.pause(); slotAudioRef.current.src = ""; } } catch (e) {}
    };
  }, [challengerSlug, opponentSlug, navigate]);

  // compute both players' points
  const opponentStats = computeStats((opponent && opponent.deck) || []);
  const opponentPointsRaw = opponentStats.pretentious + opponentStats.rewatch + opponentStats.quality + opponentStats.popularity;
  const opponentPoints = Math.round(opponentPointsRaw);
  const opponentPerMovie = distributeAttackPoints(opponentPoints, (opponent && opponent.deck) || []);

  const challengerStats = computeStats((challenger && challenger.deck) || []);
  const challengerPointsRaw = challengerStats.pretentious + challengerStats.rewatch + challengerStats.quality + challengerStats.popularity;
  const challengerPoints = Math.round(challengerPointsRaw);
  const challengerPerMovie = distributeAttackPoints(challengerPoints, (challenger && challenger.deck) || []);

  // when GO message appears, kick off first-turn animation once
  useEffect(() => {
    if (!showGoMessage) return;
    // run sequence asynchronously and only once
    let cancelled = false;

    async function runFirstTurnSequence() {
      // play readygo
      await playAudioWait(READYGO_AUDIO, 900);

      if (cancelled) return;

      // popup top stack (scale up a bit) + woosh
      if (topStackRef.current) {
        topStackRef.current.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
        topStackRef.current.style.transform = "translateY(-20px) scale(1.03)";
      }
      await playAudioWait(WOOSH_AUDIO, 500);

      if (cancelled) return;

      // compute slide distance so top stack touches challenger's top poster tips
      const topRect = topStackRef.current ? topStackRef.current.getBoundingClientRect() : null;
      const bottomRect = bottomStackRef.current ? bottomStackRef.current.getBoundingClientRect() : null;

      // fallback: slide by fixed px if measurements fail
      let slidePx = 0;
      if (topRect && bottomRect) {
        // want the bottom edge of topRect to align very close to top edge of bottomRect
        const desiredBottom = bottomRect.top + 10; // 10px gap
        slidePx = desiredBottom - topRect.top - topRect.height; // how much to move down (post-translate)
      } else {
        slidePx = 120; // safe default
      }

      // animate slide down while playing move sound
      if (topStackRef.current) {
        // ensure we start from the popped position
        topStackRef.current.style.transition = "transform 520ms cubic-bezier(.25,.9,.2,1)";
        topStackRef.current.style.transform = `translateY(${slidePx}px) scale(1.02)`;
      }
      // play move and let it run while sliding
      const movePlay = playAudioWait(MOVE_AUDIO, 600);

      // wait roughly same duration as slide
      await Promise.all([movePlay, new Promise(r => setTimeout(r, 520))]);

      if (cancelled) return;

      // on impact: play demage and darken challenger's posters briefly
      await playAudioWait(DEMAGE_AUDIO, 350);

      if (cancelled) return;

      // apply damage overlay (reduce brightness) on challengeer's posters
      if (bottomSlotRefs.current && bottomSlotRefs.current.length) {
        bottomSlotRefs.current.forEach(el => {
          if (!el) return;
          const img = el.querySelector("img");
          if (img) {
            img.style.transition = "filter 160ms ease";
            img.style.filter = "brightness(0.45) saturate(0.8)";
          }
        });
      }

      // short pause so effect is visible
      await new Promise(r => setTimeout(r, 550));

      // revert challenger's posters back to normal
      if (bottomSlotRefs.current && bottomSlotRefs.current.length) {
        bottomSlotRefs.current.forEach(el => {
          if (!el) return;
          const img = el.querySelector("img");
          if (img) {
            img.style.transition = "filter 320ms ease";
            img.style.filter = "";
          }
        });
      }

      // slide top back up into place
      if (topStackRef.current) {
        topStackRef.current.style.transition = "transform 420ms cubic-bezier(.2,.9,.2,1)";
        topStackRef.current.style.transform = "translateY(0) scale(1)";
      }

      // short delay to allow settle
      await new Promise(r => setTimeout(r, 420));

      if (cancelled) return;

      // show damage calculation UI in the middle
      setDamageLeft(opponentPoints);
      setDamageRight(challengerPoints);
      setShowDamageCalc(true);

      // animate damage calc:
      // briefly slide the left number left then back then resolve outcome
      await new Promise(r => setTimeout(r, 300));
      const leftEl = document.querySelector(".damage-left");
      if (leftEl) {
        leftEl.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
        leftEl.style.transform = "translateX(-18px)";
        await new Promise(res => setTimeout(res, 240));
        leftEl.style.transform = "translateX(0)";
        await new Promise(res => setTimeout(res, 200));
      } else {
        await new Promise(res => setTimeout(res, 460));
      }

      // determine winner (higher points wins)
      const leftPoints = opponentPoints;
      const rightPoints = challengerPoints;
      let winnerIsOpponent = leftPoints >= rightPoints;
      // if tie treat opponent (challenged) as winner for now (user expected)
      if (leftPoints === rightPoints) winnerIsOpponent = true;

      if (!winnerIsOpponent) {
        // opponent lost: challenger wins => left slides back and right turns to 0
        // But per your description, when left slides back, challenger points go to 0 (we'll invert variable names to match)
      }

      // animation for removal of losing points: if challenger lost, show challenger( right ) -> 0 with lose sound
      if (!winnerIsOpponent) {
        // challenger lost show lose animation on right
        const rightEl = document.querySelector(".damage-right");
        if (rightEl) {
          // flash and drop to 0
          rightEl.style.transition = "opacity 220ms, transform 220ms";
          rightEl.style.transform = "scale(1.04)";
          await new Promise(r => setTimeout(r, 160));
          rightEl.style.opacity = "0";
          await new Promise(r => setTimeout(r, 220));
          setDamageRight(0);
        } else {
          setDamageRight(0);
        }
        // play lose sound and show loss modal
        await playAudioWait(LOSE_AUDIO, 900);
        setShowLossModal(true);
        setTimeout(() => setShowLossModal(false), 3000); // show 3s
        // register result (challenger lost -> challengerSlug is loser, opponentSlug is winner)
        try {
          await registerResult(opponentSlug, challengerSlug);
        } catch (e) {
          console.warn("registerResult failed:", e);
        }
        // redirect to Duel list page
        setTimeout(() => navigate("/duel"), 900);
      } else {
        // opponent (challenged) wins — per description challenger loses? Wait: we used left=opponent, right=challenger
        // leftPoints >= rightPoints means opponent (top) wins -> challenger loses. That means we should treat winnerIsOpponent true => challenger loses.
        // So handle winnerIsOpponent true as challenger losing (per your example).
        // Play lose sound and show loss modal for the loser (which is challenger)
        // Per your requested flow: when left slides back to place, have challengers user movie points turn to 0 and remove this movie point text off the middle, play lose.mp3.
        // Implement that:
        // animate right -> vanish
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
        setTimeout(() => setShowLossModal(false), 3000);
        // register result: opponent wins, challenger loses
        try {
          await registerResult(opponentSlug, challengerSlug);
        } catch (e) {
          console.warn("registerResult failed:", e);
        }
        setTimeout(() => navigate("/duel"), 900);
      }

      // hide damage calc after a short pause
      setTimeout(() => setShowDamageCalc(false), 1400);
    }

    runFirstTurnSequence();

    return () => { cancelled = true; };
  }, [showGoMessage, opponentPoints, challengerPoints, opponentSlug, challengerSlug, navigate]);

  async function registerResult(winnerId, loserId) {
  const payload = { winner: winnerId, loser: loserId, via: "first_turn_auto" };

  try {
    const res = await fetch("/api/duel/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      try { await res.json(); } catch (_) {}

      //  notify app to refresh profiles / leaderboard
      window.dispatchEvent(
        new CustomEvent("leaderbox:profile-changed")
      );

      return true;
    }
  } catch (_) {}

  return false;
}

  if (loading || !challenger || !opponent) return <div className="loading">Loading duel…</div>;

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
