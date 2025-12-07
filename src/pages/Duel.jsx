import React, { useEffect, useState } from "react";
import { fetchAllProfiles } from "../lib/api";
import { useNavigate } from "react-router-dom";

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
    <div style={{
      padding: "6px 8px",
      borderRadius: 6,
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.03)",
      fontSize: 13
    }}>
      L{level}
    </div>
  );
}

function Avatar({ src, nickname, size = 72, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#0b0b0b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid rgba(255,255,255,0.03)",
        cursor: onClick ? "pointer" : "default"
      }}
    >
      {src ? (
        <img src={src} alt={nickname || "avatar"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ color: "#ddd", fontSize: Math.max(18, size / 3) }}>{(nickname || "U").slice(0,1).toUpperCase()}</div>
      )}
    </div>
  );
}

export default function Duel() {
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const r = await fetchAllProfiles();
      if (!r.ok) {
        setError(r.error || "Failed fetching profiles");
        // fallback to local saved profiles (if any)
        try {
          const localRaw = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
          if (localRaw) {
            const local = JSON.parse(localRaw);
            setProfiles(Array.isArray(local) ? local : [local]);
          } else {
            setProfiles([]);
          }
        } catch (e) {
          setProfiles([]);
        } finally {
          setLoading(false);
        }
        return;
      }
      const payload = r.data;
      // server returns { ok: true, profiles: [...] } or { ok: true, profile: {...} }
      let list = [];
      if (payload && Array.isArray(payload.profiles)) list = payload.profiles;
      else if (payload && payload.profiles === undefined && payload.ok && Array.isArray(payload)) list = payload;
      else if (payload && payload.profile && Array.isArray(payload.profile)) list = payload.profile;
      // safe normalization
      list = list.map((u) => ({
        open_id: u.open_id,
        nickname: u.nickname || (u.handle ? u.handle.replace(/^@/, "") : `@${u.open_id}`),
        avatar: u.avatar || u.pfp || null,
        wins: Number.isFinite(u.wins) ? u.wins : 0,
        losses: Number.isFinite(u.losses) ? u.losses : 0,
        level: Number.isFinite(u.level) ? u.level : 1,
      }));
      setProfiles(list);
      setLoading(false);
    })();
  }, []);

  function handleChallenge(profile) {
    // store opponent locally (duel flow can read it)
    localStorage.setItem("leaderbox_opponent", JSON.stringify(profile));
    setSelected(profile.open_id);
    // as a simple flow, redirect to /duel/play or wherever your duel flow is
    window.location.href = "/duel/play"; // change to your duel route, or remove to keep on page
  }

  const me = (() => {
    try {
      const p = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      return p ? JSON.parse(p) : null;
    } catch (e) { return null; }
  })();

  // live filtered & alphabetically sorted list
  const filtered = (profiles || []).filter(p => {
    if (!query) return true;
    return String(p.nickname || "").toLowerCase().includes(query.toLowerCase());
  }).sort((a,b) => {
    const A = (a.nickname || "").toLowerCase();
    const B = (b.nickname || "").toLowerCase();
    if (A < B) return -1;
    if (A > B) return 1;
    return 0;
  });

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <h2 className="h1-retro">Duel Arena</h2>
      <div className="small">Challenge other players — select an opponent to start.</div>

      {/* slick search bar */}
      <div style={{ width: "100%", maxWidth: 920, marginTop: 12 }}>
        <input
          placeholder="Search players by nickname..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.2)",
            color: "var(--white)",
            fontSize: 14,
            outline: "none"
          }}
        />
      </div>

      {loading && <div style={{ marginTop: 20 }}>Loading players…</div>}

      {!loading && error && (
        <div style={{ marginTop: 20, color: "#f66" }}>
          Failed to load players: {String(error)}
        </div>
      )}

      {!loading && profiles && profiles.length === 0 && (
        <div style={{ marginTop: 20 }}>No players found on server. Try adding profiles or importing local test users.</div>
      )}

      {!loading && profiles && profiles.length > 0 && (
        <div style={{
          width: "100%",
          maxWidth: 920,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}>
          {filtered.map((p) => (
            <div key={p.open_id} style={{
              padding: 12,
              borderRadius: 12,
              background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              border: selected === p.open_id ? "2px solid rgba(253, 238, 105, 0.9)" : "1px solid rgba(255,255,255,0.03)"
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar
                  src={p.avatar}
                  nickname={p.nickname}
                  size={72}
                  onClick={() => {
                    // open profile page for that user
                    const id = p.open_id || p.nickname;
                    nav(`/profile/${encodeURIComponent(id)}`);
                  }}
                />
                <div>
                  <div style={{ fontWeight: 800 }}>{p.nickname}</div>
                  <div className="small" style={{ color: "#999", marginTop: 6 }}>
                    Wins: {p.wins} • Losses: {p.losses}
                    <div style={{ marginTop: 6 }}>{`Level ${p.level} — ${getLevelName(p.level)}`}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <LevelPill level={p.level || 1} />
                {me && me.open_id && me.open_id === p.open_id ? (
                  <button className="modal-btn" disabled style={{ opacity: 0.6 }}>You</button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="modal-btn" onClick={() => handleChallenge(p)}>Challenge</button>
                    <button className="modal-btn" onClick={() => { const id = p.open_id || p.nickname; nav(`/profile/${encodeURIComponent(id)}`); }}>
                      View
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
