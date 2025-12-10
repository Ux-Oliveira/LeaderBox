import React, { useEffect, useState, useRef } from "react";
import NavBar from "../components/NavBar";
import MovieSlot from "../components/MovieSlot";
import MovieSearchModal from "../components/MovieSearchModal";
import "../styles/editstack.css";

const STORAGE_KEY = "leaderbox_deck_v1";

// Level labels
const LEVEL_LABELS = {
  1: "Noob",
  2: "Casual Viewer",
  3: "Youtuber Movie Critic",
  4: "Movie Festival Goer",
  5: "Indie Afficionado",
  6: "Cult Classics Schoolar",
  7: "Film Buff",
  8: "Film Curator",
  9: "Cinephile",
};

// Secondary descriptor placeholders (10 for pretentiousness, 10 for rewatchability).
// Replace these strings later as you like.
const PRETENTIOUS_DESCRIPTORS = [
  "Subtle Avant-Garde",
  "Artsy Casual",
  "Quirky Seeker",
  "Indie Inclined",
  "Curated Taste",
  "Obscure Hunter",
  "Artsy Purist",
  "Highbrow Devotee",
  "Cine-Philosopher",
  "Gilded Auteur"
];

const REWATCH_DESCRIPTORS = [
  "Light Entertainer",
  "Comfort Watcher",
  "Rewatch Ready",
  "Streaming Favorite",
  "Mainstream Loyal",
  "Cult Movie Fan",
  "Binge Magnet",
  "Evergreen Pick",
  "Popcorn Powerhouse",
  "Repeat Legend"
];

export default function EditStack({ user }) {
  // deck: array of 4 slots (null or movie object)
  const [deck, setDeck] = useState([null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState(null); // index of slot being edited
  const [searchOpen, setSearchOpen] = useState(false);
  const [userLevel, setUserLevel] = useState(user?.level || 1);

  // movie points info
  const [mpModalOpen, setMpModalOpen] = useState(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    // load deck from localStorage if present
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 4) setDeck(parsed);
      }
      // if user has level in app state, reflect it
      if (user && user.level) setUserLevel(user.level);
    } catch (e) {
      console.warn("Failed to load saved deck:", e);
    }
  }, [user]);

  // persist deck locally and (if logged) send to server (debounced)
  useEffect(() => {
    // persist deck locally
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
    } catch (e) {
      // ignore
    }

    // if we have a logged-in user, persist deck to server (debounced)
    if (!user) return;

    // determine user id to send
    const userId = user.id || user.open_id || user.openId || user.openId;

    if (!userId) return;

    // clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // debounce: wait 1s after last change
    saveTimeoutRef.current = setTimeout(() => {
      (async () => {
        try {
          await fetch("/api/save_deck", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({
              userId,
              deck,
            }),
          });
        } catch (e) {
          console.warn("Failed to save deck to server:", e);
        }
      })();
    }, 1000);

    // cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [deck, user]);

  function openSlot(i) {
    setActiveSlot(i);
    setSearchOpen(true);
  }

  function closeSearch() {
    setActiveSlot(null);
    setSearchOpen(false);
  }

  function setSlotMovie(i, movie) {
    const copy = [...deck];
    copy[i] = movie;
    setDeck(copy);
    closeSearch();
  }

  function clearSlot(i) {
    const copy = [...deck];
    copy[i] = null;
    setDeck(copy);
  }

  /* Stats formulas (same as your spec) */
  function computeStats(deckArr) {
    const movies = deckArr.filter(Boolean);
    if (movies.length === 0) return { pretentious: 0, rewatch: 0, quality: 0, popularity: 0 };

    // Collect raw arrays
    const scores = movies.map(m => (m.vote_average || 0)); // 0..10
    const pops = movies.map(m => (m.popularity || 0)); // unbounded

    // Normalize popularity within this deck to 0..1
    const minPop = Math.min(...pops);
    const maxPop = Math.max(...pops);
    const normPops = pops.map(p => (maxPop === minPop ? 0.5 : (p - minPop) / (maxPop - minPop)));

    // Normalize scores 0..1 (TMDB vote_average is typically 0..10)
    const normScores = scores.map(s => Math.min(1, Math.max(0, s / 10)));

    // Quality = average score (0..10)
    const quality = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Popularity average (use raw popularity)
    const popularity = pops.reduce((a, b) => a + b, 0) / pops.length;

    // Pretentiousness: high score AND low popularity -> pretentious
    const pretArr = normScores.map((ns, idx) => ns * (1 - normPops[idx]));
    const pretentious = (pretArr.reduce((a, b) => a + b, 0) / pretArr.length) * 100; // scale to 0..100

    // Rewatchability: high score * high popularity
    const rewatchArr = normScores.map((ns, idx) => ns * normPops[idx]);
    const rewatch = (rewatchArr.reduce((a, b) => a + b, 0) / rewatchArr.length) * 100;

    return {
      pretentious: Math.round(pretentious),
      rewatch: Math.round(rewatch),
      quality: +(quality.toFixed(2)),
      popularity: +(popularity.toFixed(2))
    };
  }

  const stats = computeStats(deck);

  // Movie Points: convert pretentious% and rewatch% to raw points (32% -> 32 points), add quality and popularity
  const moviePointsRaw = stats.pretentious + stats.rewatch + stats.quality + stats.popularity;
  const moviePoints = Math.round(moviePointsRaw);

  // distribute attack points across movies based on vote_average
  function distributeAttackPoints(totalPoints, moviesArr) {
    const movies = moviesArr.filter(Boolean);
    if (movies.length === 0) return [];
    // collect raw scores
    const scores = movies.map(m => (m.vote_average || 0));
    const sumScores = scores.reduce((a, b) => a + b, 0);
    if (sumScores === 0) {
      // equal split if no scores
      const base = Math.floor(totalPoints / movies.length);
      const remainder = totalPoints - base * movies.length;
      return movies.map((m, idx) => base + (idx < remainder ? 1 : 0));
    }
    // distribute proportionally rounding to integers, ensure sum equals totalPoints
    const rawAlloc = scores.map(s => (s / sumScores) * totalPoints);
    const floored = rawAlloc.map(v => Math.floor(v));
    let remainder = totalPoints - floored.reduce((a, b) => a + b, 0);
    // distribute remainder to largest fractional parts
    const fractions = rawAlloc.map((v, idx) => ({ idx, frac: v - Math.floor(v) }));
    fractions.sort((a, b) => b.frac - a.frac);
    const final = [...floored];
    for (let i = 0; i < remainder; i++) {
      final[fractions[i].idx] = final[fractions[i].idx] + 1;
    }
    return final;
  }

  // secondary descriptor selection logic
  function getSecondaryDescriptor(pret, rewatch) {
    // if both <= 10 -> none
    if ((pret || 0) <= 10 && (rewatch || 0) <= 10) return null;

    // which is higher wins; if tied, no descriptor (or pick pretentiousness by tie-breaker)
    if ((pret || 0) === (rewatch || 0)) {
      // tie: choose the higher tens (if >10) by preferring pretentious
      if ((pret || 0) > 10) {
        const idx = Math.min(9, Math.max(0, Math.floor((pret - 11) / 10 + 0)));
        return PRETENTIOUS_DESCRIPTORS[idx] || null;
      }
      return null;
    }

    const winner = (pret || 0) > (rewatch || 0) ? "pret" : "rew";
    const value = winner === "pret" ? pret : rewatch;
    if ((value || 0) <= 10) return null;

    // map value 11..100 -> descriptor index 0..9 (approx)
    // index strategy: Math.min(9, Math.floor((value - 11) / 10))
    // value=11..20 -> 0, 21..30 ->1, ..., 91..100 ->8 (approx). This gives fine granularity.
    let idx = Math.floor((value - 11) / 10);
    if (isNaN(idx) || idx < 0) idx = 0;
    idx = Math.min(9, idx);
    return winner === "pret" ? (PRETENTIOUS_DESCRIPTORS[idx] || null) : (REWATCH_DESCRIPTORS[idx] || null);
  }

  const secondaryDescriptor = getSecondaryDescriptor(stats.pretentious, stats.rewatch);

  // choose a level image file (public folder)
  const levelIndex = Math.min(9, Math.max(1, Number(userLevel || 1)));
  const levelImage = `/level${levelIndex}.png`;
  const levelLabel = LEVEL_LABELS[levelIndex] || `L${levelIndex}`;

  // attack points array for current deck
  const attackPoints = distributeAttackPoints(moviePoints, deck);

  return (
    <>
      <NavBar user={user} />
      <div className="editstack-root">
        <div className="center-stage">
          {/* rectangular block (replaces bar.gif) */}
          <div className="bar-block" aria-hidden="true" />

          <div className="bar-overlay">
            <h1 className="es-title">Choose your 4 favorite movies</h1>
            <p className="subtitle">Pick the deck that defines your taste.</p>

            <div className="slots-row" role="list">
              {deck.map((m, i) => (
                <div key={i} style={{ width: "170px", display: "flex", justifyContent: "center" }}>
                  <div className="pulsing-slot">
                    <MovieSlot
                      index={i}
                      movie={m}
                      onOpen={() => openSlot(i)}
                      onClear={() => clearSlot(i)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="deck-summary centered">
              <div className="summary-stats centered">
                <div className="stat">
                  <div className="stat-label">Pretentiousness</div>
                  <div className="stat-value">{stats.pretentious}%</div>
                </div>

                <div className="stat">
                  <div className="stat-label">Rewatchability</div>
                  <div className="stat-value">{stats.rewatch}%</div>
                </div>

                <div className="stat">
                  <div className="stat-label">Quality</div>
                  <div className="stat-value">{stats.quality} / 10</div>
                </div>

                <div className="stat">
                  <div className="stat-label">Popularity</div>
                  <div className="stat-value">{stats.popularity}</div>
                </div>
              </div>

              {/* Movie Points tile centered below other stats */}
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center", width: "100%" }}>
                <div
                  className="stat movie-points pulsing"
                  role="button"
                  tabIndex={0}
                  onClick={() => setMpModalOpen(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") setMpModalOpen(true); }}
                  aria-label="Your Movie Points — click to learn more"
                  title="Movie Points - click to learn more"
                  style={{ minWidth: 220, maxWidth: 260, textAlign: "center", cursor: "pointer" }}
                >
                  <div className="stat-label">Movie Points</div>
                  <div className="stat-value">{moviePoints} pts</div>
                </div>
              </div>

              {/* LEVEL AREA: now absolutely positioned and visually inside the bar-block at its bottom */}
              <div className="level-area" aria-hidden={false}>
                <img
                  src={levelImage}
                  alt={`Level ${levelIndex}`}
                  className="level-image"
                  onError={(e) => { e.currentTarget.style.opacity = 0.12; }}
                />
              </div>
            </div>

            {/* Secondary descriptor(s) placed under stats (yellow) */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ color: "var(--yellow)", fontWeight: 800 }}>
                {levelLabel}
              </div>
              {secondaryDescriptor ? (
                <div style={{ color: "var(--yellow)", opacity: 0.95 }}>
                  {secondaryDescriptor}
                </div>
              ) : (
                <div style={{ color: "var(--yellow)", opacity: 0.7 }}>
                  Yikes! Try shifting your taste.
                </div>
              )}
            </div>

            {/* Brush up on the rules button (use direct client nav for reliability) */}
            <div style={{ marginTop: 18 }}>
              <button
                className="ms-btn"
                style={{ textDecoration: "none", display: "inline-block" }}
                onClick={() => { window.location.href = "/rules"; }}
              >
                Brush up on the rules
              </button>
            </div>
          </div>
        </div>

        {/* NOTE: Level caption moved into the bar; removed external caption to keep it inside the bar */}
      </div>

      <MovieSearchModal
        open={searchOpen}
        onClose={closeSearch}
        onSelect={(movie) => setSlotMovie(activeSlot, movie)}
      />

      {/* Movie Points modal */}
      {mpModalOpen && (
        <div
          className="mp-modal-backdrop"
          onClick={() => setMpModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>What are Movie Points?</h3>
            <p style={{ marginTop: 8 }}>
              Movie Points are the sum of your deck's stats. Pretentiousness and Rewatchability get turned from percentages to raw points (e.g. 32% → 32 points) and,<br />
              that number is added up with the Quality and Popularity stats, giving you your Movie Points.<br />
              The goal of each duel is to depleate your opponent's Movie points.
            </p>
            <p style={{ marginTop: 6 }}>
              These points form the basis for each movie's attack points. Your movie points are destributed across your movies on the basis of which movie has the bigger critics score.
            </p>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button className="ms-btn" onClick={() => setMpModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
