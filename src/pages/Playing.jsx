// src/pages/Playing.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/playstyle.css";

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

async function fetchProfileBySlug(slug) {
  if (!slug) return null;
  try {
    const res = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.profile || json;
  } catch (e) {
    return null;
  }
}

function computeStats(deckArr) {
  const movies = (deckArr || []).filter(Boolean);
  if (!movies.length) return { pretentious: 0, rewatch: 0, quality: 0, popularity: 0 };

  const scores = movies.map(m => m.vote_average || 0);
  const pops = movies.map(m => m.popularity || 0);

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
  if (!movies.length) return [];
  const scores = movies.map(m => m.vote_average || 0);
  const sumScores = scores.reduce((a, b) => a + b, 0);
  if (sumScores === 0) {
    const base = Math.floor(totalPoints / movies.length);
    const remainder = totalPoints - base * movies.length;
    return movies.map((_, idx) => base + (idx < remainder ? 1 : 0));
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
  const { challenger: challengerSlug, challenged: challengedSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState(null);
  const [challenged, setChallenged] = useState(null);
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
          fetchProfileBySlug(challengedSlug),
        ]);

        if (!mounted) return;

        if (!c || !o) {
          alert("Error loading duel users");
          navigate(-1);
          return;
        }

        // normalize decks and points
        c.deck = Array.isArray(c.deck) ? c.deck : [];
        c.level = Number.isFinite(c.level) ? c.level : 1;
        o.deck = Array.isArray(o.deck) ? o.deck : [];
        o.level = Number.isFinite(o.level) ? o.level : 1;

        setChallenger(c);
        setChallenged(o);

        // silent audio to unlock
        silentAudioRef.current = new Audio(SILENT_AUDIO);
        silentAudioRef.current.volume = 0;
        silentAudioRef.current.play().catch(() => {});

        // slot audio
        slotAudioRef.current = new Audio(SLOT_AUDIO);

        // readygo audio
        readyGoRef.current = new Audio(READYGO_AUDIO);

        // background audio
        const idx = Math.floor(Math.random() * BACKGROUND_SONGS.length);
        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop = true;
        bg.volume = 0.14;
        bgAudioRef.current = bg;

        setTimeout(() => {
          if (bgAudioRef.current) bgAudioRef.current.play().catch(() => {});
        }, 100);

        // start reveal
        startRevealSequence(o.deck, c.deck);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    function startRevealSequence(topDeck, bottomDeck) {
      // Top reveal: challenged user
      let topStep = 0;
      const topTick = () => {
        if (topStep < topDeck.length) {
          setRevealIndexTop(topStep);
          if (slotAudioRef.current) slotAudioRef.current.cloneNode(true).play().catch(() => {});
          topStep++;
          setTimeout(topTick, 500);
        } else {
          // Bottom reveal: challenger
          let bottomStep = 0;
          const bottomTick = () => {
            if (bottomStep < bottomDeck.length) {
              setRevealIndexBottom(bottomStep);
              if (slotAudioRef.current) slotAudioRef.current.cloneNode(true).play().catch(() => {});
              bottomStep++;
              setTimeout(bottomTick, 500);
            } else {
              // All revealed → 1st Turn
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
    return () => { mounted = false; };
  }, [challengerSlug, challengedSlug, navigate]);

  if (loading || !challenger || !challenged) return <div className="loading">Loading duel…</div>;

  // challenger points
  const challengerStats = computeStats(challenger.deck);
  const challengerPointsRaw = challengerStats.pretentious + challengerStats.rewatch + challengerStats.quality + challengerStats.popularity;
  const challengerPoints = Math.round(challengerPointsRaw);
  const challengerPerMovie = distributeAttackPoints(challengerPoints, challenger.deck);

  return (
    <div className="playing-root">
      <div className="player-top">
        <div className="player-info">
          <img src={challenged.avatar || ""} alt={challenged.nickname} className="pfp"/>
          <div className="username-level">
            <div className="username">{challenged.nickname}</div>
            <div className="level">Level {challenged.level}</div>
          </div>
        </div>
        <div className="movie-slots">
          {challenged.deck.map((m, i) => {
            const poster = posterFor(m);
            const visible = i <= revealIndexTop;
            return (
              <div key={i} className={`slot ${visible ? "visible from-top" : "hidden from-top"}`}>
                {poster ? <img src={poster} alt={m.title || m.name} /> : <div className="empty-slot">—</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="spacer"/>

      <div className="player-bottom">
        <div className="movie-slots">
          {challenger.deck.map((m, i) => {
            const poster = posterFor(m);
            const visible = i <= revealIndexBottom;
            return (
              <div key={i} className={`slot ${visible ? "visible from-bottom" : "hidden from-bottom"}`}>
                {poster ? <img src={poster} alt={m.title || m.name} /> : <div className="empty-slot">—</div>}
              </div>
            );
          })}
        </div>
        <div className="player-info-bottom">
          <img src={challenger.avatar || ""} alt={challenger.nickname} className="pfp"/>
          <div className="username-level">
            <div className="username">{challenger.nickname}</div>
            <div className="level">Level {challenger.level}</div>
            <div className="points">{challengerPoints} pts</div>
            <div className="atk-points">
              {challengerPerMovie.map((p, idx) => <span key={idx}>{p} atk</span>)}
            </div>
          </div>
        </div>
      </div>

      <button className="yellow-btn">Brush up on the rules</button>

      {showGoMessage && <div className="go-message">1st Turn: GO!</div>}
    </div>
  );
}
