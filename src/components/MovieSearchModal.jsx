import React, { useEffect, useState } from "react";

/*
  MovieSearchModal
  - open (bool), onClose(), onSelect(movie)
  - Behavior:
      1) If a client-side saved key exists (localStorage 'tmdb_api_key') use it.
      2) Else, if the app has a PUBLIC env var (process.env.NEXT_PUBLIC_TMDB_API_KEY) use that.
      3) Else, if a server proxy '/api/tmdb_search' exists, call it (preferred for production).
      4) Otherwise show input to paste/save an API key to localStorage.
*/

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function getStoredKey() {
  if (typeof window === "undefined") return null;
  if (window.__ENV && window.__ENV.TMDB_API_KEY) return window.__ENV.TMDB_API_KEY;
  try {
    // process.env.* is replaced at build-time for many setups (Next/Vite). Use it if present.
    if (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_TMDB_API_KEY) {
      return process.env.NEXT_PUBLIC_TMDB_API_KEY;
    }
  } catch (e) {
    // ignore
  }
  return localStorage.getItem("tmdb_api_key");
}

export default function MovieSearchModal({ open, onClose, onSelect }) {
  const [apiKey, setApiKey] = useState(getStoredKey() || "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // keep apiKey and UI reset in sync when modal opens/closes
  useEffect(() => {
    setApiKey(getStoredKey() || "");
    setResults([]);
    setQuery("");
    setError("");
  }, [open]);

  // Debounced live search as the user types
  useEffect(() => {
    if (!open) return;
    const q = (query || "").trim();
    if (q.length < 1) {
      // if query cleared, clear results and don't show "No results yet" as an error
      setResults([]);
      setError("");
      return;
    }
    const id = setTimeout(() => {
      doSearch(q);
    }, 300); // 300ms debounce
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  async function doSearch(q) {
    if (!q || q.trim().length < 1) return;

    // Decide search path:
    // 1) If a server proxy exists, use it (recommended).
    // 2) Else if we have an API key available for client, call TMDb directly.
    setError("");
    setLoading(true);
    setResults([]);

    // prefer server proxy
    const useServerProxy = true; // set true to prefer proxy; change if you want direct calls
    try {
      if (useServerProxy) {
        // call your serverless endpoint which will call TMDb using server-only env var
        const res = await fetch(`/api/tmdb_search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          const txt = await res.text();
          setError(`Search proxy error: ${res.status} ${txt}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        const items = Array.isArray(data.results) ? data.results : [];
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
        setLoading(false);
        return;
      }

      // fallback: client-side direct call to TMDb (requires NEXT_PUBLIC_TMDB_API_KEY or local key)
      const key = apiKey || getStoredKey();
      if (!key) {
        setError("No TMDB API key set. Paste one above and click 'Save key'.");
        setLoading(false);
        return;
      }

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

        {/* ALWAYS show the real search bar immediately */}
        <div className="ms-keyarea">
          <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
            <input
              placeholder="Search movie title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ms-input"
              autoFocus
            />
            <button className="ms-btn" onClick={() => doSearch(query)} disabled={loading}>Search</button>
          </div>

          {/* Key controls kept but non-blocking: user can save/clear a local key */}
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              placeholder="Optional: paste TMDB API key (only if you want direct client calls)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="ms-input"
              style={{ flex: "1 1 320px" }}
            />
            <button className="ms-btn" onClick={handleSaveKey}>Save key</button>
            <button className="ms-btn ms-ghost" onClick={() => { setApiKey(""); localStorage.removeItem("tmdb_api_key"); }}>Clear saved key</button>
          </div>

          <div className="small" style={{ opacity: 0.8, marginTop: 6 }}>
            You can use the server proxy (recommended) — or paste a TMDB key to call TMDB directly.
          </div>
        </div>

        <div className="ms-results">
          {loading && <div className="small">Searching…</div>}
          {error && <div style={{ color: "#f66" }}>{error}</div>}

          {!loading && results.length === 0 && query.trim().length > 0 && (
            <div className="small" style={{ opacity: 0.8 }}>No results yet — try a different query.</div>
          )}

          {!loading && results.length === 0 && query.trim().length === 0 && (
            <div className="small" style={{ opacity: 0.8 }}>Start typing to see results.</div>
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
