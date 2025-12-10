
import React, { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import MovieSlot from "../components/MovieSlot";
import MovieSearchModal from "../components/MovieSearchModal";
import "../styles/editstack.css";
import Support from "../components/Support";

const STORAGE_KEY = "leaderbox_deck_v1";

// Level labels (keeps parity with existing site wording)
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

export default function EditStack({ user }) {
  // deck: array of 4 slots (null or movie object)
  const [deck, setDeck] = useState([null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState(null); // index of slot being edited
  const [searchOpen, setSearchOpen] = useState(false);
  const [userLevel, setUserLevel] = useState(user?.level || 1);

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

  useEffect(() => {
    // persist deck
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
    } catch (e) {
      // ignore
    }
  }, [deck]);

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

  // choose a level image file (public folder)
  const levelIndex = Math.min(9, Math.max(1, Number(userLevel || 1)));
  const levelImage = `/level${levelIndex}.png`;
  const levelLabel = LEVEL_LABELS[levelIndex] || `L${levelIndex}`;

  return (
    <>
      <NavBar user={user} />
      <div className="editstack-root">
        <div className="center-stage">
          {/* rectangular block (replaces bar.gif) */}
          <div className="bar-block" aria-hidden="true" />

          <div className="bar-overlay">
            <h1>Choose your 4 favorite movies</h1>
            <p className="subtitle">Pick the deck that defines your taste.</p>

            <div className="slots-row" role="list">
              {deck.map((m, i) => (
                <MovieSlot
                  key={i}
                  index={i}
                  movie={m}
                  onOpen={() => openSlot(i)}
                  onClear={() => clearSlot(i)}
                />
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
          </div>
        </div>

        {/* NOTE: Level caption moved into the bar; removed external caption to keep it inside the bar */}
      </div>

      <MovieSearchModal
        open={searchOpen}
        onClose={closeSearch}
        onSelect={(movie) => setSlotMovie(activeSlot, movie)}
      />
      <Support />
    </>
  );
}
