// src/pages/DuelFirstTurn.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const READYGO_AUDIO = "/audios/readygo.mp3";
const WOOSH_AUDIO = "/audios/woosh.mp3";
const MOVE_AUDIO = "/audios/move.mp3";
const DAMAGE_AUDIO = "/audios/demage.mp3";

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
    const res = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (res.ok) {
      const json = await res.json();
      return json.profile || json;
    }
  } catch (e) {}
  try {
    const res = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (res.ok) {
      const json = await res.json();
      return json.profile || json;
    }
  } catch (e) {}
  return null;
}

export default function DuelFirstTurn() {
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [opponent, setOpponent] = useState(null);

  const [showGoMessage, setShowGoMessage] = useState(false);
  const [topSlotsVisible, setTopSlotsVisible] = useState([false, false, false, false]);
  const [bottomSlotsDamage, setBottomSlotsDamage] = useState([false, false, false, false]);

  const rootRef = useRef(null);
  const readygoRef = useRef(null);
  const wooshRef = useRef(null);
  const moveRef = useRef(null);
  const damageRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [c, o] = await Promise.all([
          fetchProfileBySlug(challengerSlug),
          fetchProfileBySlug(opponentSlug)
        ]);

        if (!mounted) return;

        if (!c || !o) {
          setError("Could not load one or both profiles.");
          setLoading(false);
          return;
        }

        // Normalize
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

        // Prepare audio
        readygoRef.current = new Audio(READYGO_AUDIO);
        wooshRef.current = new Audio(WOOSH_AUDIO);
        moveRef.current = new Audio(MOVE_AUDIO);
        damageRef.current = new Audio(DAMAGE_AUDIO);

        // Start first turn sequence
        startFirstTurnSequence();
      } catch (err) {
        console.error(err);
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function startFirstTurnSequence() {
      // 1) Show "1st Turn: Go!" and play READYGO_AUDIO
      setShowGoMessage(true);
      try { await readygoRef.current.play(); } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
      setShowGoMessage(false);

      // 2) Reveal opponent slots with WOOSH_AUDIO
      setTopSlotsVisible([true, true, true, true]);
      try { await wooshRef.current.play(); } catch (e) {}
      await new Promise(r => setTimeout(r, 600));

      // 3) Animate posters down with MOVE_AUDIO
      try { await moveRef.current.play(); } catch (e) {}
      // This will animate via CSS class, use a timeout to simulate completion
      await new Promise(r => setTimeout(r, 800));

      // 4) Play DAMAGE_AUDIO and flash bottom slots
      try { await damageRef.current.play(); } catch (e) {}
      setBottomSlotsDamage([true, true, true, true]);
      await new Promise(r => setTimeout(r, 400));
      setBottomSlotsDamage([false, false, false, false]);
    }

    init();

    return () => { mounted = false; };
  }, [challengerSlug, opponentSlug]);

  if (loading) return <div style={{ padding: 24 }}><h2 className="h1-retro">Loading duel…</h2></div>;
  if (error) return (
    <div style={{ padding: 24 }}>
      <h2 className="h1-retro">Duel error</h2>
      <div style={{ color: "#f66", marginTop: 8 }}>{error}</div>
      <div style={{ marginTop: 12 }}>
        <button className="ms-btn" onClick={() => navigate(-1)}>Go back</button>
      </div>
    </div>
  );
  if (!challenger || !opponent) return <div style={{ padding: 24 }}><h2 className="h1-retro">Missing duel participants</h2></div>;

  return (
    <div ref={rootRef} className="duel-first-turn-root" style={{ padding: 24, display: "flex", justifyContent: "center", position: "relative" }}>
      <div className="center-stage" style={{ width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", alignItems: "center", margin: "0 auto" }}>
        <div className="bar-block" />

        <div className="bar-overlay">
          {/* 1) Show GO Message */}
          {showGoMessage && <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)", marginBottom: 12 }}>1st Turn: Go!</div>}

          {/* 2) Opponent slots */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const m = opponent.deck[i];
              const poster = posterFor(m);
              const visible = topSlotsVisible[i];
              return (
                <div key={`opp-slot-${i}`} style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div
                    className={`slot-poster-wrap ${visible ? "pop" : ""}`}
                    style={{
                      width: 92,
                      height: 136,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#0d0d10",
                      boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none",
                      transform: visible ? "translateY(0)" : "translateY(-50px)",
                      transition: "transform 600ms cubic-bezier(.2,.9,.2,1), opacity 400ms"
                    }}
                  >
                    {poster ? <img src={poster} alt={m?.title || m?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3) Challenger slots (highlight damage) */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const m = challenger.deck[i];
              const poster = posterFor(m);
              const damage = bottomSlotsDamage[i];
              return (
                <div key={`chal-slot-${i}`} style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div
                    className={`slot-poster-wrap ${damage ? "damage" : ""}`}
                    style={{
                      width: 92,
                      height: 136,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: damage ? "linear-gradient(to bottom, #ff0000, #800000)" : "#0d0d10",
                      transition: "background 400ms"
                    }}
                  >
                    {poster ? <img src={poster} alt={m?.title || m?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .slot-poster-wrap.pop { transform: scale(1.1); }
        .slot-poster-wrap.damage { /* red gradient applied inline */ }
        .center-stage { width: 100%; max-width: 720px; position: relative; display:flex; align-items:center; justify-content:center; padding:24px; }
        .bar-block { width: 100%; height: 780px; background: #101221; border-radius: 14px; box-shadow: 0 8px 40px rgba(0,0,0,0.6); position: absolute; top:0; left:0; right:0; z-index: 10; }
        .bar-overlay { position: relative; width: calc(100% - 80px); margin: 0 40px; z-index: 40; color: var(--white); display:flex; flex-direction: column; align-items:center; gap:16px; padding:22px 10px 28px; text-align:center; }
      `}</style>
    </div>
  );
}
