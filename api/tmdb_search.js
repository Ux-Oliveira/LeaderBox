// api/tmdb_search.js
// Server-side proxy for TMDb search. Caller: GET /api/tmdb_search?q=movie+name
// Uses process.env.TMDB_API_KEY (server-only) or process.env.TMDB_READ_ACCESS_TOKEN (Bearer).
// WARNING: add authentication/rate-limiting in production as needed.

import fetch from "node-fetch";

export default async function handler(req, res) {
  const q = (req.query && req.query.q) || (typeof req.body === "object" && req.body.q) || "";
  if (!q || q.trim().length === 0) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  try {
    // Prefer server-side API key
    const serverApiKey = process.env.TMDB_API_KEY;
    const readToken = process.env.TMDB_READ_ACCESS_TOKEN;

    let tmdbUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&page=1&include_adult=false`;

    const headers = {
      "Accept": "application/json"
    };

    // If TMDB_API_KEY available, use api_key param (v3)
    if (serverApiKey) {
      tmdbUrl += `&api_key=${encodeURIComponent(serverApiKey)}`;
    } else if (readToken) {
      // else use bearer token
      headers["Authorization"] = `Bearer ${readToken}`;
    } else {
      res.status(500).json({ error: "TMDB API key not configured on server." });
      return;
    }

    const tmdbRes = await fetch(tmdbUrl, { headers });
    if (!tmdbRes.ok) {
      const txt = await tmdbRes.text();
      res.status(502).json({ error: `TMDB responded ${tmdbRes.status}: ${txt}` });
      return;
    }

    const data = await tmdbRes.json();
    // you may want to filter/trim data here to limit size
    res.status(200).json({ results: data.results || [] });
  } catch (err) {
    console.error("tmdb_search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
