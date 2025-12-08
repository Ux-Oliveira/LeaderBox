import React, { useEffect, useState } from "react";

/*
  MovieSearchModal.jsx
  - searches TMDB (requires REACT_APP_TMDB_KEY)
  - shows results with small stats (vote_average, popularity, genres)
  - onSelect returns constructed movie object to caller
*/

const TMDB_KEY = process.env.REACT_APP_TMDB_KEY || ""; // set this in your env

function tmdbPosterUrl(path, size = "w342") {
  if (!path) return "/poster-placeholder.png";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export default function MovieSearchModal({ open = false, onClose = () => {}, onSelect = () => {} }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genresMap, setGenresMap] = useState({}); // id -> name

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
    // preload TMDB genres for mapping
    (async function loadGenres() {
      if (!TMDB_KEY) return;
      try {
        const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US`);
        if (!res.ok) return;
        const json = await res.json();
        const map = {};
        (json.genres || []).forEach(g => map[g.id] = g.name);
        setGenresMap(map);
      } catch (e) {
        // ignore
      }
    })();
  }, [open]);

  async function doSearch(q) {
    if (!q || !TMDB_KEY) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_KEY)}&query=${encodeURIComponent(q)}&page=1&include_adult=false`;
      const res = await fetch(url);
      if (!res.ok) {
        setResults([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const items = (data.results || []).slice(0, 12).map(item => ({
        id: item.id,
        title: item.title,
        poster_path: item.poster_path,
        poster_full: tmdbPosterUrl(item.poster_path, "w342"),
        release_date: item.release_date,
        vote_average: item.vote_average,
        popularity: item.popularity,
        overview: item.overview,
        genre_ids: item.genre_ids || []
      }));
      setResults(items);
    } catch (err) {
      console.warn("TMDB search failed", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function chooseMovie(m) {
    // enrich movie with genre names
    const genres = (m.genre_ids || []).map(id => genresMap[id]).filter(Boolean);
    const chosen = { ...m, genres };
    onSelect(chosen);
  }

  if (!open) return null;

  return (
    <div className="modal-root" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Search movies</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="search-row">
          <input
            placeholder="Search TMDB for a movie title..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") doSearch(query); }}
          />
          <button onClick={() => doSearch(query)} disabled={!query || !TMDB_KEY}>Search</button>
        </div>

        {!TMDB_KEY && (
          <div className="notice">No TMDB API key found. Set REACT_APP_TMDB_KEY in your environment to enable search.</div>
        )}

        <div className="results">
          {loading && <div className="loading">Searching…</div>}
          {!loading && results.length === 0 && <div className="empty">No results</div>}

          {results.map(r => (
            <div className="result-row" key={r.id}>
              <img className="res-poster" src={r.poster_full} alt={r.title} />
              <div className="res-info">
                <div className="res-title">{r.title} <span className="res-year">{r.release_date ? `(${r.release_date.slice(0,4)})` : ""}</span></div>
                <div className="res-overview">{r.overview && r.overview.slice(0,140)}</div>

                <div className="res-stats">
                  <div>Score: {r.vote_average || "—"}</div>
                  <div>Popularity: {Math.round(r.popularity || 0)}</div>
                  <div>Genres: {(r.genre_ids || []).map(id => genresMap[id]).filter(Boolean).slice(0,3).join(", ")}</div>
                </div>

              </div>

              <div className="res-actions">
                <button className="select-btn" onClick={() => chooseMovie(r)}>Select</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
