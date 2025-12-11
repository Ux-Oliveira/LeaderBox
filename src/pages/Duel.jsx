// src/pages/Duel.jsx
import React, { useEffect, useState } from "react";
import { fetchAllProfiles } from "../lib/api";
import { useNavigate } from "react-router-dom";

const SILENT_AUDIO = "/audios/silent.mp3";

const LEVELS = [
  { level: 1, name: "Noob" },
  { level: 2, name: "Casual Viewer" },
  { level: 3, name: "Youtuber Movie Critic" },
  { level: 4, name: "Movie Festival Goer" },
  { level: 5, name: "Indie Afficionado" },
  { level: 6, name: "Cult Classics Schoolar" },
  { level: 7, name: "Film Buff" },
  { level: 8, name: "Film Curator" },
  { level: 9, name: "Cinephile" }
];

function getLevelName(level) {
  const found = LEVELS.find(l => Number(l.level) === Number(level));
  return found ? found.name : "Unknown";
}

function LevelPill({ level }) {
  return (
    <div style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.03)", fontSize: 13 }}>
      L{level}
    </div>
  );
}

function Avatar({ src, nickname, size = 72, onClick }) {
  if (!src) {
    return (
      <div onClick={onClick} style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#111", color: "#ddd", fontSize: Math.max(18, size / 3), cursor: onClick ? "pointer" : "default", borderRadius: 6 }}>
        {(nickname || "U").slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={nickname || "avatar"}
      onClick={onClick}
      style={{ width: size, height: size, objectFit: "cover", display: "block", cursor: onClick ? "pointer" : "default", borderRadius: 6 }}
    />
  );
}

function MovieThumb({ movie }) {
  const poster = movie && (movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : movie.poster || movie.image || movie.posterUrl || (movie.raw && (movie.raw.poster || movie.raw.poster_path) ? (movie.raw.poster_path ? `https://image.tmdb.org/t/p/w342${movie.raw.poster_path}` : movie.raw.poster) : null));
  return (
    <div style={{ width: 92, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: 92, height: 136, borderRadius: 6, overflow: "hidden", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {poster ? <img src={poster} alt={movie.title || movie.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ color: "#888" }}>—</div>}
      </div>
      <div style={{ width: 92, height: 36, textAlign: "center", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {movie?.title || movie?.name || ""}
      </div>
    </div>
  );
}

export default function Duel() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetchAllProfiles();
        if (!r.ok) {
          setProfiles([]);
          setLoading(false);
          return;
        }
        const payload = r.data;
        let list = [];
        if (payload && Array.isArray(payload.profiles)) list = payload.profiles;
        else if (payload && payload.profiles === undefined && payload.ok && Array.isArray(payload)) list = payload;
        else if (payload && payload.profile && Array.isArray(payload.profile)) list = payload.profile;

        list = list.map(u => ({
          open_id: u.open_id,
          nickname: u.nickname || (u.handle ? u.handle.replace(/^@/, "") : `@${u.open_id}`),
          avatar: u.avatar || u.pfp || null,
          wins: Number.isFinite(u.wins) ? u.wins : 0,
          losses: Number.isFinite(u.losses) ? u.losses : 0,
          draws: Number.isFinite(u.draws) ? u.draws : 0,
          level: Number.isFinite(u.level) ? u.level : 1,
          deck: Array.isArray(u.deck) ? u.deck : []
        }));

        setProfiles(list);
      } catch (err) {
        console.error("fetchAllProfiles exception:", err);
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const me = (() => {
    try {
      const p = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      return p ? JSON.parse(p) : null;
    } catch (e) {
      return null;
    }
  })();

  function slugFromProfile(p) {
    if (!p) return null;
    if (p.nickname) {
      try { return String(p.nickname).replace(/^@+/, "").trim(); } catch (e) {}
    }
    if (p.handle) {
      try { return String(p.handle).replace(/^@+/, "").trim(); } catch (e) {}
    }
    if (p.open_id) return String(p.open_id);
    return null;
  }

  // NAVIGATE to page DuelPlay instead of opening modal
  async function handleChallenge(profile) {
    try {
      const challengerProfile = me;
      if (!challengerProfile) {
        alert("Please log in or set your profile before challenging another player.");
        nav("/profile");
        return;
      }

      // store opponent for fallback/legacy
      localStorage.setItem("leaderbox_opponent", JSON.stringify(profile));

      // attempt to play silent audio to unlock sound before navigation (best-effort)
      try {
        if (SILENT_AUDIO) {
          const s = new Audio(SILENT_AUDIO);
          s.volume = 0;
          await s.play().catch(() => {});
        }
      } catch (e) {
        // ignore
      }

      // build slugs and navigate to the page route that renders src/pages/DuelPlay.jsx
      const challengerSlug = slugFromProfile(challengerProfile);
      const opponentSlug = slugFromProfile(profile);

      if (challengerSlug && opponentSlug) {
        // route: /duel/play/:challenger/:opponent
        nav(`/duel/play/${encodeURIComponent(challengerSlug)}/${encodeURIComponent(opponentSlug)}`);
      } else {
        // fallback: go to generic duel/play page and rely on localStorage
        window.location.href = "/duel/play";
      }
    } catch (e) {
      console.warn("handleChallenge failed, falling back to navigation", e);
      const challengerSlug = slugFromProfile(me);
      const opponentSlug = slugFromProfile(profile);
      if (challengerSlug && opponentSlug) {
        nav(`/duel/play/${encodeURIComponent(challengerSlug)}/${encodeURIComponent(opponentSlug)}`);
      } else {
        localStorage.setItem("leaderbox_opponent", JSON.stringify(profile));
        window.location.href = "/duel/play";
      }
    }
  }

  async function openDetail(profile) {
    if (profile.deck && Array.isArray(profile.deck)) {
      profile.draws = Number.isFinite(profile.draws) ? profile.draws : 0;
      setDetail(profile);
      return;
    }
    try {
      const res = await fetch(`/api/profile?open_id=${encodeURIComponent(profile.open_id)}`, { credentials: "same-origin" });
      if (!res.ok) {
        profile.draws = Number.isFinite(profile.draws) ? profile.draws : 0;
        setDetail(profile);
        return;
      }
      const txt = await res.text();
      let json = null;
      try { json = JSON.parse(txt); } catch (e) {}
      const full = json && (json.profile || json) ? (json.profile || json) : profile;
      full.draws = Number.isFinite(full.draws) ? full.draws : 0;
      full.deck = Array.isArray(full.deck) ? full.deck : [];
      setDetail(full);
    } catch (e) {
      console.warn("failed to fetch full profile:", e);
      profile.draws = Number.isFinite(profile.draws) ? profile.draws : 0;
      setDetail(profile);
    }
  }

  const filtered = (profiles || []).filter(p => {
    if (me && String(me.open_id) === String(p.open_id)) return false;
    if (!query) return true;
    return String(p.nickname || "").toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => (a.nickname || "").localeCompare(b.nickname || ""));

  return (
    <div style={{ width: "100%" }}>
      <h2 className="h1-retro">Duel Arena</h2>
      <div className="small">Challenge other players — select an opponent to start.</div>

      <div style={{ width: "100%", maxWidth: 920, marginTop: 12 }}>
        <input
          placeholder="Search players by nickname..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)", color: "var(--white)", fontSize: 14, outline: "none" }}
        />
      </div>

      {loading && <div style={{ marginTop: 20 }}>Loading players…</div>}

      {!loading && filtered.length === 0 && <div style={{ marginTop: 20 }}>No players found.</div>}

      {!loading && filtered.length > 0 && (
        <div style={{ width: "100%", maxWidth: 1100, marginTop: 12 }}>
          <div className="profiles-scroll" style={{ maxHeight: "72vh", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, padding: 6 }}>
            {filtered.map(p => (
              <div key={p.open_id} style={{ padding: 12, borderRadius: 12, background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div onClick={() => openDetail(p)} style={{ cursor: "pointer" }}>
                    <Avatar src={p.avatar} nickname={p.nickname} size={72} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{p.nickname}</div>
                    <div className="small" style={{ color: "#999", marginTop: 6 }}>
                      Wins: {p.wins} • Losses: {p.losses} • Draws: {p.draws}
                    </div>
                    <div style={{ marginTop: 6 }}>Level {p.level} — {getLevelName(p.level)}</div>
                  </div>
                  <LevelPill level={p.level || 1} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <img src="/play.png" alt="play" style={{ width: 36, height: 36, cursor: "pointer", animation: "subtlePulse 2.5s infinite" }} onClick={() => handleChallenge(p)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(1100px, 96vw)", maxHeight: "90vh", overflow: "auto", borderRadius: 12, background: "linear-gradient(180deg, rgba(8,9,12,0.98), rgba(16,18,24,0.98))", padding: 18, boxShadow: "0 20px 80px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img src={detail.avatar} alt={detail.nickname} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 18 }}>{detail.nickname}</div>
                <div className="small" style={{ color: "#999", marginTop: 6 }}>Wins: {detail.wins} • Losses: {detail.losses} • Draws: {detail.draws}</div>
                <div style={{ marginTop: 6 }}>Level {detail.level} — {getLevelName(detail.level)}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: "transparent", border: "none", color: "var(--white)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              {(detail.deck && Array.isArray(detail.deck) && detail.deck.length > 0) ? detail.deck.map((m, idx) => (<MovieThumb key={idx} movie={m} />)) : (
                <div className="small" style={{ color: "#999" }}>No public stack available.</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
              <img src="/play.png" alt="challenge" style={{ width: 56, height: 56, cursor: "pointer", animation: "subtlePulse 2.5s infinite" }} onClick={() => handleChallenge(detail)} />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes subtlePulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`}</style>
    </div>
  );
}
