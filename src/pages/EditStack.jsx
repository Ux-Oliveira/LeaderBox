import React, { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import MovieSlot from "../components/MovieSlot";
import MovieSearchModal from "../components/MovieSearchModal";
import "../styles/editstack.css";

const STORAGE_KEY = "leaderbox_deck_v1";

/*
  EditStack.jsx
  - Shows bar.png background area with 4 slots
  - Opens MovieSearchModal to search/select from TMDB
  - Calculates summary stats and shows deck description + user level
*/

export default function EditStack({ user }) {
  // deck: array of 4 slots (null or movie object)
  const [deck, setDeck] = useState([null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState(null); // index of slot being edited
  const [searchOpen, setSearchOpen] = useState(false);
  const [deckDescription, setDeckDescription] = useState("");
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

  /* Stats formulas (basic first-pass; tweak weights later):
     - Pretentiousness = avg( inverse popularity, high critic score ) roughly:
         = avg( (1 - norm_pop), norm_score ) where norms are normalized 0..1 within deck
     - Rewatchability = avg(norm_score * norm_pop)
     - Quality = average critic score (vote_average)
     - Popularity = average popularity (TMDB popularity field)
  */
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
    const quality = scores.reduce((a,b) => a + b, 0) / scores.length;

    // Popularity average (use raw popularity)
    const popularity = pops.reduce((a,b) => a + b, 0) / pops.length;

    // Pretentiousness: high score AND low popularity -> pretentious
    // For each movie: (normScore * (1 - normPop))
    const pretArr = normScores.map((ns, idx) => ns * (1 - normPops[idx]));
    const pretentious = (pretArr.reduce((a,b) => a + b, 0) / pretArr.length) * 100; // scale to 0..100

    // Rewatchability: high score * high popularity
    const rewatchArr = normScores.map((ns, idx) => ns * normPops[idx]);
    const rewatch = (rewatchArr.reduce((a,b) => a + b, 0) / rewatchArr.length) * 100;

    return {
      pretentious: Math.round(pretentious),
      rewatch: Math.round(rewatch),
      quality: +(quality.toFixed(2)),
      popularity: +(popularity.toFixed(2))
    };
  }

  const stats = computeStats(deck);

  return (
    <>
      <NavBar user={user} />
      <div className="editstack-root">
        <div className="center-stage">
          <img src="/bar.png" alt="bar" className="bar-image" />
          <div className="bar-overlay">
            <h1>Choose your 4 favorite movies</h1>
            <p className="subtitle">Pick the deck that defines your taste.</p>

            <div className="slots-row">
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

            <div className="deck-summary">
              <div className="summary-stats">
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

              <div className="deck-meta">
                <label className="small">Deck description</label>
                <textarea
                  value={deckDescription}
                  onChange={e => setDeckDescription(e.target.value)}
                  placeholder="Describe what this deck is about..."
                />

                <div className="level-row">
                  <div>Level:</div>
                  <div className="level-pill">L{userLevel}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <MovieSearchModal
        open={searchOpen}
        onClose={closeSearch}
        onSelect={(movie) => setSlotMovie(activeSlot, movie)}
      />
    </>
  );
}
