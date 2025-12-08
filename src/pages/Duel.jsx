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

/* uniform avatar component; always fixed size and rounded */
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
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0
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
  const [detail, setDetail] = useState(null); // for centered overlay modal of a single profile
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

  /* helper to make a nice slug from nickname (strip @ if present) */
  function slugFromNickname(nick) {
    if (!nick) return "profile";
    return String(nick).replace(/^@/, "").trim();
  }

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

      {/* scrollable modal-like panel for profiles */}
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
            maxHeight: "60vh", // scroll within modal area
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            padding: 6
          }}>
            {filtered.map((p) => (
              <div key={p.open_id} style={{
                padding: 12,
                borderRadius: 12,
                background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignItems: "stretch",
                border: selected === p.open_id ? "2px solid rgba(253, 238, 105, 0.9)" : "1px solid rgba(255,255,255,0.03)"
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {/* uniform pfp on upper-left */}
                  <Avatar
                    src={p.avatar}
                    nickname={p.nickname}
                    size={72}
                    onClick={() => {
                      // show centered overlay modal with details
                      setDetail(p);
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    {/* nickname and stats right of pfp */}
                    <div style={{ fontWeight: 800 }}>{p.nickname}</div>
                    <div className="small" style={{ color: "#999", marginTop: 6 }}>
                      Wins: {p.wins} • Losses: {p.losses}
                      <div style={{ marginTop: 6 }}>{`Level ${p.level} — ${getLevelName(p.level)}`}</div>
                    </div>
                  </div>

                  {/* small right column with the level pill */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <LevelPill level={p.level || 1} />
                  </div>
                </div>

                {/* play button area (below info) - uses /play.png */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="modal-btn"
                    onClick={() => handleChallenge(p)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", width: 120, justifyContent: "center" }}
                  >
                    <img src="/play.png" alt="play" style={{ width: 20, height: 20, display: "block" }} />
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* centered overlay modal for single profile detail (click avatar to open) */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(600px, 92vw)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.02))",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
              position: "relative"
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                {detail.avatar ? (
                  <img src={detail.avatar} alt={detail.nickname} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", color: "#ddd", fontSize: 36 }}>
                    {(detail.nickname || "U").slice(0,1).toUpperCase()}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: "var(--accent)", fontSize: 20 }}>{detail.nickname}</div>
                <div className="small" style={{ color: "#999", marginTop: 8 }}>
                  Wins: {detail.wins} • Losses: {detail.losses}
                </div>
                <div style={{ marginTop: 8 }}>{`Level ${detail.level} — ${getLevelName(detail.level)}`}</div>

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button className="modal-btn" onClick={() => { handleChallenge(detail); }}>
                    <img src="/play.png" alt="play" style={{ width: 18, height: 18, marginRight: 8 }} /> Challenge
                  </button>
                  <button className="modal-btn" onClick={() => {
                    const slug = slugFromNickname(detail.nickname);
                    nav(`/profile/${encodeURIComponent(slug)}`);
                    setDetail(null);
                  }}>
                    View profile
                  </button>
                </div>
              </div>
            </div>

            <button onClick={() => setDetail(null)} style={{ position: "absolute", right: 12, top: 12, background: "transparent", border: "none", color: "var(--white)", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
