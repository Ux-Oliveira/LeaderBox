import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * DuelPlay.jsx
 *
 * Route pattern: /duel/play/:challenger/:opponent
 *
 * Behavior:
 * - Fetch challenger & opponent profiles by nickname/open_id via /api/profile?nickname=... or ?open_id=...
 * - Try to play a tiny silent audio to unlock autoplay in some browsers.
 * - Pick a background song from /audios/song1.mp3... stored in localStorage index to rotate songs.
 * - Reveal slots top->center->bottom with animations and play /audios/slot.mp3 on each reveal.
 * - After reveal, show "1st Turn: Go!" for 1s.
 *
 * Notes:
 * - Audio files are expected to be in public/audios/:
 *    /audios/silent.mp3    (very short silent file, optional)
 *    /audios/slot.mp3
 *    /audios/song1.mp3
 *    /audios/song2.mp3
 *    ...
 * - Attack/MP calculations are placeholders but show how to render attack points beneath each slot.
 */

const BACKGROUND_SONGS = [
  "/audios/song1.mp3",
  "/audios/song2.mp3",
  "/audios/song3.mp3",
  "/audios/song4.mp3",
];

const SLOT_AUDIO = "/audios/slot.mp3";
const SILENT_AUDIO = "/audios/silent.mp3"; // optional short silent file in public/audios

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

function clampTitle(title) {
  if (!title) return "";
  return title;
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

export default function DuelPlay() {
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [error, setError] = useState(null);

  // animation and audio state
  const [revealIndex, setRevealIndex] = useState(-1); // -1 = not started, 0..3 reveal steps
  const [showGoMessage, setShowGoMessage] = useState(false);
  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const mountedRef = useRef(true);

  // On mount: fetch profiles, attempt silent unlock, pick bg song, then start reveal sequence
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [c, o] = await Promise.all([fetchProfileBySlug(challengerSlug), fetchProfileBySlug(opponentSlug)]);
        if (!mountedRef.current) return;

        if (!c || !o) {
          setError("Could not load one or both profiles.");
          setLoading(false);
          return;
        }

        // normalize fields we rely on
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

        // audio: try to play a short silent audio to unlock (best effort)
        try {
          if (SILENT_AUDIO) {
            const s = new Audio(SILENT_AUDIO);
            s.volume = 0;
            s.play().catch(() => { /* ignore autoplay block */ });
            silentAudioRef.current = s;
          }
        } catch (e) { /* ignore */ }

        // load slot audio
        slotAudioRef.current = new Audio(SLOT_AUDIO);
        slotAudioRef.current.preload = "auto";

        // choose background song index (rotate using localStorage)
        const lastIdxRaw = localStorage.getItem("leaderbox_last_song_idx");
        let idx = 0;
        try {
          const last = Number.isFinite(+lastIdxRaw) ? Number(lastIdxRaw) : -1;
          idx = (last + 1) % BACKGROUND_SONGS.length;
        } catch (e) { idx = Math.floor(Math.random() * BACKGROUND_SONGS.length); }
        localStorage.setItem("leaderbox_last_song_idx", String(idx));
        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop = true;
        bg.volume = 0.14; // low volume by default (you can adjust)
        bg.preload = "auto";
        bgAudioRef.current = bg;
        // try to play bg (may be blocked if silent unlock failed)
        bg.play().catch(() => { /* will rely on user gesture if blocked */ });

        // start reveal sequence after a short delay so user can see modal appear
        setTimeout(() => {
          // reveals 4 top + 4 bottom total? your design: each side has 4 slots
          // We will reveal slots in order 0..3 top, then 0..3 bottom (interleaved or sequential)
          // Per request: "top movies slide from top to bottom and on the bottom from bottom to top" - we'll reveal top slots first then bottom.
          startRevealSequence();
        }, 400);
      } catch (err) {
        console.error("duel play init error", err);
        if (mountedRef.current) setError(String(err));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    function startRevealSequence() {
      // We'll reveal across 4 steps per side => 4 reveals top and 4 reveals bottom (total 8).
      // For simplicity of UI we keep revealIndex as number of revealed chunks (0..7)
      let step = 0;
      const total = Math.max(4, Math.max((opponent && opponent.deck?.length) || 0, (challenger && challenger.deck?.length) || 0)) * 2;
      // reveal timing: 500ms per reveal
      const revealTick = () => {
        if (!mountedRef.current) return;
        setRevealIndex(step); // this indicates how many reveals have run (0 means first)
        // play slot audio
        try {
          if (slotAudioRef.current) {
            // play clone to allow overlap
            const a = slotAudioRef.current.cloneNode(true);
            a.volume = 0.9;
            a.play().catch(() => {});
          }
        } catch (e) {}
        step++;
        if (step < total) {
          setTimeout(revealTick, 500);
        } else {
          // after reveal finished: show "1st Turn: Go!" for 1 second
          setTimeout(() => {
            setShowGoMessage(true);
            setTimeout(() => setShowGoMessage(false), 1000);
          }, 250);
        }
      };
      revealTick();
    }

    init();

    return () => {
      mountedRef.current = false;
      // cleanup audios
      try { if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.src = ""; } } catch (e) {}
      try { if (slotAudioRef.current) { slotAudioRef.current.pause(); slotAudioRef.current.src = ""; } } catch (e) {}
      try { if (silentAudioRef.current) { silentAudioRef.current.pause(); silentAudioRef.current.src = ""; } } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengerSlug, opponentSlug]);

  // convenience: attack points distribution (mirrors editstack logic)
  function computeMoviePoints(deckArr) {
    const movies = deckArr.filter(Boolean);
    if (movies.length === 0) return { total: 0, perMovie: [] };
    const scores = movies.map(m => (m.vote_average || 0));
    const quality = scores.reduce((a, b) => a + b, 0) / scores.length;
    const popularity = movies.map(m => (m.popularity || 0)).reduce((a, b) => a + b, 0) / movies.length;
    // simplified pretentious/rewatch percentages for demo
    const pret = 20;
    const rew = 20;
    const mpRaw = pret + rew + quality + popularity;
    const totalPoints = Math.max(1, Math.round(mpRaw));
    // distribute proportional to vote_average
    const sum = scores.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      const base = Math.floor(totalPoints / movies.length);
      const rem = totalPoints - base * movies.length;
      return {
        total: totalPoints,
        perMovie: movies.map((m, i) => base + (i < rem ? 1 : 0)),
      };
    }
    const rawAlloc = scores.map(s => (s / sum) * totalPoints);
    const floored = rawAlloc.map(v => Math.floor(v));
    let remainder = totalPoints - floored.reduce((a, b) => a + b, 0);
    const fractions = rawAlloc.map((v, idx) => ({ idx, frac: v - Math.floor(v) }));
    fractions.sort((a, b) => b.frac - a.frac);
    const final = [...floored];
    for (let i = 0; i < remainder; i++) {
      final[fractions[i].idx] = final[fractions[i].idx] + 1;
    }
    return { total: totalPoints, perMovie: final };
  }

  // render helpers for reveal logic:
  // revealIndex 0..7 indicates how many reveals ran; we consider top reveals first: top[0..3] indices 0..3; bottom[0..3] indices 4..7
  function isTopSlotVisible(i) {
    if (revealIndex < 0) return false;
    return revealIndex >= (i + 1) - 1; // i=0 -> revealIndex >=0
  }
  function isBottomSlotVisible(i) {
    if (revealIndex < 0) return false;
    // bottom slot i corresponds to revealIndex >= 4 + i
    const base = 4;
    return revealIndex >= base + i;
  }

  // but because revealIndex increments by 1 each tick, we need a mapping: revealIndex >= (i) etc.
  // We'll compute a safer function using time-based approach: revealCount = revealIndex + 1
  function topVisible(i) {
    const revealCount = revealIndex + 1;
    return revealCount > i; // revealCount 1 shows i=0
  }
  function bottomVisible(i) {
    const revealCount = revealIndex + 1;
    return revealCount > (4 + i);
  }

  // small UI early returns
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

  // compute movie points + attack arrays
  const challengerPoints = computeMoviePoints(challenger.deck || []);
  const opponentPoints = computeMoviePoints(opponent.deck || []);

  return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <div className="center-stage">
        <div className="bar-block" aria-hidden />
        <div className="bar-overlay" style={{ alignItems: "stretch" }}>
          {/* Top — Opponent header */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 72, height: 72, overflow: "hidden", borderRadius: 10 }}>
                {opponent.avatar ? <img src={opponent.avatar} alt={opponent.nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "72px", height: "72px", background: "#111" }}>{(opponent.nickname||"U").slice(0,1)}</div>}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 18 }}>{opponent.nickname}</div>
                <div className="small" style={{ color: "#ddd" }}>Level {opponent.level}</div>
              </div>
            </div>
          </div>

          {/* Opponent slots (top row) */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const m = (opponent.deck && opponent.deck[i]) ? opponent.deck[i] : null;
              const poster = posterFor(m);
              const visible = topVisible(i);
              return (
                <div key={`opp-slot-${i}`} className={`duel-slot ${visible ? "visible from-top" : "hidden from-top"}`} style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div className="slot-poster-wrap" style={{ width: 92, height: 136, borderRadius: 8, overflow: "hidden", background: "#0d0d10", boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none", transition: "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms" }}>
                    {poster && visible ? <img src={poster} alt={m.title || m.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>}
                  </div>
                  <div style={{ width: 92, height: 36, textAlign: "center", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", color: "#fff", opacity: visible ? 1 : 0.3, transition: "opacity 300ms" }}>
                    {m ? (m.title || m.name) : ""}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", minHeight: 18 }}>
                    {visible && (opponentPoints.perMovie[i] !== undefined ? `${opponentPoints.perMovie[i]} atk` : "—")}
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

            {/* Play controls could go here - center has space */}
            <div style={{ height: 6 }} />

            {/* Challenger slots (bottom row) */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => {
                const m = (challenger.deck && challenger.deck[i]) ? challenger.deck[i] : null;
                const poster = posterFor(m);
                const visible = bottomVisible(i);
                return (
                  <div key={`you-slot-${i}`} className={`duel-slot ${visible ? "visible from-bottom" : "hidden from-bottom"}`} style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div className="slot-poster-wrap" style={{ width: 92, height: 136, borderRadius: 8, overflow: "hidden", background: "#0d0d10", boxShadow: visible ? "0 8px 18px rgba(0,0,0,0.6)" : "none", transition: "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms" }}>
                      {poster && visible ? <img src={poster} alt={m.title || m.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>—</div>}
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

            {/* Movie Points totals */}
            <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div className="small" style={{ color: "#999" }}>Opponent Movie Points</div>
                <div style={{ fontWeight: 900, color: "var(--accent)" }}>{opponentPoints.total} pts</div>
              </div>
              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.03)" }} />
              <div style={{ textAlign: "center" }}>
                <div className="small" style={{ color: "#999" }}>Your Movie Points</div>
                <div style={{ fontWeight: 900, color: "var(--accent)" }}>{challengerPoints.total} pts</div>
              </div>
            </div>

            {/* small spacer */}
            <div style={{ height: 8 }} />
          </div>

          {/* Bottom: Challenger header (mirrors top) */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 72, height: 72, overflow: "hidden", borderRadius: 10 }}>
                {challenger.avatar ? <img src={challenger.avatar} alt={challenger.nickname} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "72px", height: "72px", background: "#111" }}>{(challenger.nickname||"U").slice(0,1)}</div>}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 18 }}>{challenger.nickname}</div>
                <div className="small" style={{ color: "#ddd" }}>Level {challenger.level}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* small accessibility: if audio blocked, show a notice/button to enable */}
      <div style={{ position: "fixed", left: 18, bottom: 18 }}>
        <button className="ms-btn" onClick={() => {
          // user gesture to resume background audio
          try {
            if (bgAudioRef.current) bgAudioRef.current.play().catch(() => {});
          } catch (e) {}
        }}>Enable Audio</button>
      </div>

      <style>{`
        /* Duel Play specific slot animations */
        .duel-slot.hidden { opacity: 0.0; transform: translateY(0); }
        .duel-slot.visible { opacity: 1; }
        .duel-slot.from-top { transform-origin: top center; }
        .duel-slot.from-bottom { transform-origin: bottom center; }

        /* Use CSS transitions for smooth sliding: when visible, we translate to 0, otherwise offset */
        .duel-slot.hidden.from-top .slot-poster-wrap { transform: translateY(-18px) scale(0.98); opacity: 0.0; }
        .duel-slot.visible.from-top .slot-poster-wrap { transform: translateY(0) scale(1); opacity: 1; }

        .duel-slot.hidden.from-bottom .slot-poster-wrap { transform: translateY(18px) scale(0.98); opacity: 0.0; }
        .duel-slot.visible.from-bottom .slot-poster-wrap { transform: translateY(0) scale(1); opacity: 1; }

        /* subtle focus + hover for poster */
        .slot-poster-wrap img { transition: transform 240ms ease; display:block; }
        .slot-poster-wrap:hover img { transform: scale(1.02); }

        /* message animation */
        @keyframes pulseAccent {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
