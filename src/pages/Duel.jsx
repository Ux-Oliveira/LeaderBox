import React, { useEffect, useState } from "react";
import { fetchAllProfiles } from "../lib/api";
import { useNavigate } from "react-router-dom";

/*
  Duel.jsx - Full fixed file
  - Raw avatars (no circle frame)
  - Play button is only an image with subtle pulse
  - Can't challenge yourself (your profile is removed from list)
  - Smaller centered modal with near-opaque black background
  - Scroll container uses a single rectangular light purple scrollbar thumb
*/

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

/* Raw avatar (no framing; mirrors ProfileModal's raw image look) */
function Avatar({ src, nickname, size = 72, onClick }) {
  if (!src) {
    return (
      <div
        onClick={onClick}
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#ddd",
          fontSize: Math.max(18, size / 3),
          cursor: onClick ? "pointer" : "default"
        }}
      >
        {(nickname || "U").slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
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

/* Subtle pulse for the play icon */
const playButtonBase = {
  width: 36,
  height: 36,
  cursor: "pointer",
  transformOrigin: "center center",
  transition: "transform 120ms ease, filter 120ms ease",
  /* animation will be injected via inline <style> pulse keyframes below */
};

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
      try {
        const r = await fetchAllProfiles();
        if (!r.ok) {
          setError(r.error || "Failed fetching profiles");
          // fallback to local saved profile(s)
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
          level: Number.isFinite(u.level) ? u.level : 1,
        }));

        setProfiles(list);
        setLoading(false);
      } catch (err) {
        console.error("fetchAllProfiles exception:", err);
        setError("Failed fetching profiles");
        setProfiles([]);
        setLoading(false);
      }
    })();
  }, []);

  /* Read local "me" once so we can exclude it from the list */
  const me = (() => {
    try {
      const p = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      return p ? JSON.parse(p) : null;
    } catch (e) {
      return null;
    }
  })();

  function handleChallenge(profile) {
    // final guard to prevent self-challenge
    try {
      if (me && String(me.open_id) === String(profile.open_id)) {
        alert("You can't challenge yourself — pick another player.");
        return;
      }
    } catch (e) {
      console.warn("Self-check failed", e);
    }

    localStorage.setItem("leaderbox_opponent", JSON.stringify(profile));
    setSelected(profile.open_id);
    // proceed to duel play flow
    window.location.href = "/duel/play";
  }

  /* filter: exclude logged-in user entirely from the arena */
  const filtered = (profiles || []).filter(p => {
    if (me && String(me.open_id) === String(p.open_id)) return false; // exclude self
    if (!query) return true;
    return String(p.nickname || "").toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => {
    const A = (a.nickname || "").toLowerCase();
    const B = (b.nickname || "").toLowerCase();
    return A.localeCompare(B);
  });

  function slugFromNickname(nick) {
    if (!nick) return "profile";
    return String(nick).replace(/^@/, "").trim();
  }

  /* subtle pulse keyframes CSS (very gentle) */
  const pulseKeyframes = `
    @keyframes subtlePulse {
      0% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
      50% { transform: scale(1.05); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.06)); }
      100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
    }
  `;

  const playButtonStyle = {
    ...playButtonBase,
    animation: "subtlePulse 2.5s infinite",
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {/* inject subtle pulse keyframes */}
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
          <div className="profiles-scroll" style={{
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
                  {/* play icon only; subtle pulse */}
                  <img
                    src="/play.png"
                    alt="play"
                    style={playButtonStyle}
                    onClick={() => handleChallenge(p)}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* smaller centered modal for profile detail */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)", // near-opaque background
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(420px, 92vw)",   // smaller focused modal
              background: "#000",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 40px rgba(0,0,0,0.9)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img
                src={detail.avatar}
                alt={detail.nickname}
                style={{ width: 96, height: 96, objectFit: "cover" }}
              />
              <div>
                <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 18 }}>{detail.nickname}</div>
                <div className="small" style={{ color: "#999", marginTop: 6 }}>Wins: {detail.wins} • Losses: {detail.losses}</div>
                <div style={{ marginTop: 6 }}>Level {detail.level} — {getLevelName(detail.level)}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-start", alignItems: "center" }}>
              <img
                src="/play.png"
                alt="play"
                style={{ ...playButtonStyle, width: 48, height: 48 }}
                onClick={() => handleChallenge(detail)}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              />
            </div>

            <button
              onClick={() => setDetail(null)}
              style={{ position: "absolute", right: 12, top: 12, background: "transparent", border: "none", color: "var(--white)", fontSize: 18, cursor: "pointer" }}
              aria-label="Close profile"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
