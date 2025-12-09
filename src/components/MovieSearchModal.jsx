import React, { useEffect, useState } from "react";

/*
  MovieSearchModal
  - open (bool), onClose(), onSelect(movie)
  - Will try to read API key from:
      1) localStorage 'tmdb_api_key'
      2) window.__ENV?.TMDB_API_KEY
    If not present, it shows a small input to paste/store the API key locally.
  - Uses TMDB Search API when key present.
  - Returns a normalized movie object with fields:
      { id, title, overview, poster_path (full url), vote_average, popularity, genre_ids }
*/

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function getStoredKey() {
  if (typeof window === "undefined") return null;
  if (window.__ENV && window.__ENV.TMDB_API_KEY) return window.__ENV.TMDB_API_KEY;
  return localStorage.getItem("tmdb_api_key");
}

export default function MovieSearchModal({ open, onClose, onSelect }) {
  const [apiKey, setApiKey] = useState(getStoredKey() || "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setApiKey(getStoredKey() || "");
    setResults([]);
    setQuery("");
    setError("");
  }, [open]);

  async function doSearch(q) {
    if (!q || q.trim().length < 1) return;
    const key = apiKey || getStoredKey();
    if (!key) {
      setError("No TMDB API key set. Paste one above and click 'Save key'.");
      return;
    }
    setError("");
    setLoading(true);
    setResults([]);
    try {
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&page=1&include_adult=false`;
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text();
        setError(`TMDB error: ${res.status} ${txt}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data.results) ? data.results : [];
      // Normalize results
      const normalized = items.map(it => ({
        id: it.id,
        title: it.title || it.name,
        overview: it.overview,
        poster_path: it.poster_path ? (TMDB_IMAGE_BASE + it.poster_path) : null,
        vote_average: it.vote_average,
        popularity: it.popularity,
        release_date: it.release_date,
        genre_ids: it.genre_ids || []
      }));
      setResults(normalized);
    } catch (e) {
      console.warn("Search failure", e);
      setError("Search failed — check console and your API key.");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveKey() {
    try {
      localStorage.setItem("tmdb_api_key", apiKey);
      alert("TMDB API key saved to localStorage.");
    } catch (e) {
      console.warn("Could not save key", e);
      alert("Failed to save key locally.");
    }
  }

  function handleSelect(m) {
    // Return the movie object to the parent. Parent will store it in deck.
    onSelect && onSelect(m);
  }

  if (!open) return null;

  return (
    <div className="ms-modal-backdrop" onClick={onClose}>
      <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ms-header">
          <h3>Search movies</h3>
          <button className="ms-close" onClick={onClose}>✕</button>
        </div>

        <div className="ms-keyarea">
          {!apiKey ? (
            <>
              <input
                placeholder="Paste your TMDB API key here"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="ms-input"
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ms-btn" onClick={handleSaveKey}>Save key</button>
                <button className="ms-btn ms-ghost" onClick={() => { setApiKey(""); localStorage.removeItem("tmdb_api_key"); }}>Forget key</button>
              </div>
              <div className="small" style={{ opacity: 0.8, marginTop: 6 }}>
                If you don't have a TMDB key yet you can sign up at the TMDB website and create an API key.
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                <input
                  placeholder="Search movie title..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doSearch(query); }}
                  className="ms-input"
                />
                <button className="ms-btn" onClick={() => doSearch(query)} disabled={loading}>Search</button>
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="ms-btn ms-ghost" onClick={() => { setApiKey(""); localStorage.removeItem("tmdb_api_key"); }}>Clear saved key</button>
              </div>
            </>
          )}
        </div>

        <div className="ms-results">
          {loading && <div className="small">Searching…</div>}
          {error && <div style={{ color: "#f66" }}>{error}</div>}

          {!loading && results.length === 0 && (
            <div className="small" style={{ opacity: 0.8 }}>No results yet — try a different query.</div>
          )}

          <div className="ms-grid">
            {results.map((r) => (
              <div key={r.id} className="ms-item" onClick={() => handleSelect(r)}>
                <img src={r.poster_path || "/poster-fallback.png"} alt={r.title} onError={(e) => e.currentTarget.src = "/poster-fallback.png"} />
                <div className="ms-item-meta">
                  <div className="ms-title">{r.title}</div>
                  <div className="ms-sub small">
                    Score: {r.vote_average ?? "—"} • Popularity: {Math.round(r.popularity || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
