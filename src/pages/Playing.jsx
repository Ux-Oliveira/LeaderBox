// src/pages/Playing.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/playstyle.css"; // ensure this path matches your project

const BACKGROUND_SONGS = [
  "/audios/city_battle_stars.mp3",
  "/audios/cinematic_battle.mp3",
  "/audios/fun_battle.mp3",
  "/audios/retro_battle.mp3",
];

const SLOT_AUDIO = "/audios/slot.mp3";
const SILENT_AUDIO = "/audios/silent.mp3";
const READYGO_AUDIO = "/audios/readygo.mp3";

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
      } catch (e) {
        // ignore parse failure
      }
    }
  } catch (e) { /* ignore */ }

  // fallback by open_id
  try {
    const byId = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byId.ok) {
      const txt = await byId.text();
      try {
        const json = JSON.parse(txt);
        const profile = json.profile || json;
        return profile;
      } catch (e) {
        // ignore
      }
    }
  } catch (e) { /* ignore */ }

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

export default function Playing() {
  // param names must match Duel navigation route
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [revealIndexTop, setRevealIndexTop] = useState(-1);
  const [revealIndexBottom, setRevealIndexBottom] = useState(-1);
  const [showGoMessage, setShowGoMessage] = useState(false);

  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const readyGoRef = useRef(null);
  const silentAudioRef = useRef(null);

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

        // silent audio to unlock (best-effort)
        try {
          if (SILENT_AUDIO) {
            const s = new Audio(SILENT_AUDIO);
            s.volume = 0;
            s.play().catch(() => {});
            silentAudioRef.current = s;
          }
        } catch (e) { /* ignore */ }

        // slot audio preload
        slotAudioRef.current = new Audio(SLOT_AUDIO);
        slotAudioRef.current.preload = "auto";

        // readygo audio
        readyGoRef.current = new Audio(READYGO_AUDIO);

        // choose background song index (rotate with localStorage like DuelPlay)
        const lastIdxRaw = localStorage.getItem("leaderbox_last_song_idx");
        let idx = 0;
        try {
          const last = Number.isFinite(+lastIdxRaw) ? Number(lastIdxRaw) : -1;
          idx = (last + 1) % BACKGROUND_SONGS.length;
        } catch (e) {
          idx = Math.floor(Math.random() * BACKGROUND_SONGS.length);
        }
        localStorage.setItem("leaderbox_last_song_idx", String(idx));

        // prepare bg audio and attempt play (best-effort)
        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop = true;
        bg.volume = 0.14;
        bg.preload = "auto";
        bgAudioRef.current = bg;
        setTimeout(() => {
          if (bgAudioRef.current) bgAudioRef.current.play().catch(() => {});
        }, 100);

        // start reveal sequence (opponent/top first, then challenger/bottom)
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
          if (slotAudioRef.current) slotAudioRef.current.cloneNode(true).play().catch(() => {});
          topStep++;
          setTimeout(topTick, 500);
        } else {
          let bottomStep = 0;
          const bottomTick = () => {
            if (bottomStep < bottomDeck.length) {
              setRevealIndexBottom(bottomStep);
              if (slotAudioRef.current) slotAudioRef.current.cloneNode(true).play().catch(() => {});
              bottomStep++;
              setTimeout(bottomTick, 500);
            } else {
              setShowGoMessage(true);
              if (readyGoRef.current) readyGoRef.current.play().catch(() => {});
              setTimeout(() => setShowGoMessage(false), 1000);
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
      // cleanup audios
      try { if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current.src = ""; } } catch (e) {}
      try { if (slotAudioRef.current) { slotAudioRef.current.pause(); slotAudioRef.current.src = ""; } } catch (e) {}
      try { if (silentAudioRef.current) { silentAudioRef.current.pause(); silentAudioRef.current.src = ""; } } catch (e) {}
    };
  }, [challengerSlug, opponentSlug, navigate]);

  if (loading || !challenger || !opponent) return <div className="loading">Loading duel…</div>;

  // challenger points only (as requested)
  const challengerStats = computeStats(challenger.deck || []);
  const challengerPointsRaw = challengerStats.pretentious + challengerStats.rewatch + challengerStats.quality + challengerStats.popularity;
  const challengerPoints = Math.round(challengerPointsRaw);
  const challengerPerMovie = distributeAttackPoints(challengerPoints, challenger.deck || []);

  return (
    <div className="playing-root">
      <div className="player-top">
        <div className="player-info">
          <img src={opponent.avatar || ""} alt={opponent.nickname} className="pfp"/>
          <div className="username-level">
            <div className="username">{opponent.nickname}</div>
            <div className="level">Level {opponent.level}</div>
          </div>
        </div>

        <div className="movie-slots">
          {(opponent.deck || []).map((m, i) => {
            const poster = posterFor(m);
            const visible = i <= revealIndexTop;
            return (
              <div key={i} className="slot-wrap">
                <div className={`slot ${visible ? "visible from-top" : "hidden from-top"}`}>
                  {poster ? <img src={poster} alt={m.title || m.name} /> : <div className="empty-slot">—</div>}
                </div>
                {/* opponent: reserve space but do not display atk */}
                <div className="atk-badge placeholder" aria-hidden="true"> </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="spacer" />

      <div className="player-bottom">
        <div className="movie-slots">
          {(challenger.deck || []).map((m, i) => {
            const poster = posterFor(m);
            const visible = i <= revealIndexBottom;
            const atkLabel = challengerPerMovie && challengerPerMovie[i] !== undefined ? `${challengerPerMovie[i]} atk` : "—";
            return (
              <div key={i} className="slot-wrap">
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

      <button className="yellow-btn">Brush up on the rules</button>

      {showGoMessage && <div className="go-message">1st Turn: GO!</div>}
    </div>
  );
}
