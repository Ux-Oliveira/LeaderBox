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
    <img
      src={src || ""}
      alt={nickname || "avatar"}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        display: "block",
        cursor: onClick ? "pointer" : "default"
      }}
    />
  );
}

// pulsating animation for play button
const playButtonStyle = {
  width: 36,
  height: 36,
  cursor: "pointer",
  animation: "pulse 1.2s infinite",
  transition: "transform 0.16s ease",
};
const pulseKeyframes = `
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
`;

export default function Duel() {
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const r = await fetchAllProfiles();
      if (!r.ok) {
        setError(r.error || "Failed fetching profiles");
        try {
          const localRaw = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
          if (localRaw) {
            const local = JSON.parse(localRaw);
            setProfiles(Array.isArray(local) ? local : [local]);
          } else setProfiles([]);
        } catch (e) { setProfiles([]); }
        finally { setLoading(false); }
        return;
      }
      let list = [];
      const payload = r.data;
      if (payload && Array.isArray(payload.profiles)) list = payload.profiles;
      else if (payload && payload.profiles === undefined && payload.ok && Array.isArray(payload)) list = payload;
      else if (payload && payload.profile && Array.isArray(payload.profile)) list = payload.profile;

      list = list.map(u => ({
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
    try {
      const meRaw = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      const me = meRaw ? JSON.parse(meRaw) : null;
      if (me && String(me.open_id) === String(profile.open_id)) {
        alert("You can't challenge yourself — pick another player.");
        return;
      }
    } catch (e) {
      console.warn("Could not read local profile to check self-challenge:", e);
    }
    localStorage.setItem("leaderbox_opponent", JSON.stringify(profile));
    setSelected(profile.open_id);
    window.location.href = "/duel/play";
  }

  const me = (() => {
    try {
      const p = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      return p ? JSON.parse(p) : null;
    } catch (e) { return null; }
  })();

  const filtered = (profiles || []).filter(p => {
    if (!query) return true;
    return String(p.nickname || "").toLowerCase().includes(query.toLowerCase());
  }).sort((a,b) => {
    const A = (a.nickname || "").toLowerCase();
    const B = (b.nickname || "").toLowerCase();
    return A.localeCompare(B);
  });

  function slugFromNickname(nick) {
    if (!nick) return "profile";
    return String(nick).replace(/^@/, "").trim();
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <style>{pulseKeyframes}</style>
      <h2 className="h1-retro">Duel Arena</h2>
      <div className="small">Challenge other players — select an opponent to start.</div>

      <div style={{ width: "100%", maxWidth: 920, marginTop: 12 }}>
        <input
          placeholder="Search players by nickname..."
          value={query}
          onChange={e => setQuery(e.target.value)}
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
      {!loading && error && <div style={{ marginTop: 20, color: "#f66" }}>Failed to load players: {String(error)}</div>}
      {!loading && profiles && profiles.length === 0 && <div style={{ marginTop: 20 }}>No players found.</div>}

      {!loading && profiles && profiles.length > 0 && (
        <div style={{
          width: "100%",
          maxWidth: 920,
          marginTop: 12,
          background: "transparent",
          borderRadius: 12,
          padding: 8,
          boxSizing: "border-box"
        }}>
          <div style={{
            maxHeight: "60vh",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            padding: 6
          }}>
            {filtered.map(p => (
              <div key={p.open_id} style={{
                padding: 12,
                borderRadius: 12,
                background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: selected === p.open_id ? "2px solid rgba(253, 238, 105, 0.9)" : "1px solid rgba(255,255,255,0.03)"
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar src={p.avatar} nickname={p.nickname} size={72} onClick={() => setDetail(p)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{p.nickname}</div>
                    <div className="small" style={{ color: "#999", marginTop: 6 }}>
                      Wins: {p.wins} • Losses: {p.losses}
                      <div style={{ marginTop: 6 }}>Level {p.level} — {getLevelName(p.level)}</div>
                    </div>
                  </div>
                  <LevelPill level={p.level || 1} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <img
                    src="/play.png"
                    alt="play"
                    style={playButtonStyle}
                    onClick={() => handleChallenge(p)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* modal for profile detail */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,1)", // fully black opaque
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(600px, 92vw)",
              background: "#000", // black opaque modal background
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <img
                src={detail.avatar}
                alt={detail.nickname}
                style={{ width: 120, height: 120, objectFit: "cover" }}
              />
              <div>
                <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 20 }}>{detail.nickname}</div>
                <div className="small" style={{ color: "#999", marginTop: 8 }}>Wins: {detail.wins} • Losses: {detail.losses}</div>
                <div style={{ marginTop: 8 }}>Level {detail.level} — {getLevelName(detail.level)}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <img
                src="/play.png"
                alt="play"
                style={playButtonStyle}
                onClick={() => handleChallenge(detail)}
              />
            </div>

            <button
              onClick={() => setDetail(null)}
              style={{ position: "absolute", right: 12, top: 12, background: "transparent", border: "none", color: "var(--white)", fontSize: 18, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
