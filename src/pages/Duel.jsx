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
          cursor: onClick ? "pointer" : "default",
          borderRadius: 6
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
      style={{ width: size, height: size, objectFit: "cover", display: "block", cursor: onClick ? "pointer" : "default", borderRadius: 6 }}
    />
  );
}

export default function Duel() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  // safe localStorage profile parsing
  const me = (() => {
    try {
      const p = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      return p ? JSON.parse(p) : null;
    } catch (e) {
      console.warn("Failed parsing localStorage profile:", e);
      return null;
    }
  })();

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

        const payload = r.data || {};
        let list = [];
        if (payload && Array.isArray(payload.profiles)) list = payload.profiles;
        else if (Array.isArray(payload)) list = payload;
        else if (payload.profile && Array.isArray(payload.profile)) list = payload.profile;

        list = list.map(u => ({
          open_id: u.open_id,
          nickname: u.nickname || (u.handle ? u.handle.replace(/^@/, "") : `@${u.open_id}`),
          avatar: u.avatar || u.pfp || null,
          wins: Number.isFinite(u.wins) ? u.wins : 0,
          losses: Number.isFinite(u.losses) ? u.losses : 0,
          draws: Number.isFinite(u.draws) ? u.draws : 0,
          level: Number.isFinite(u.level) ? u.level : 1,
          deck: Array.isArray(u.deck) ? u.deck : [],
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

  function slugFromProfile(p) {
    if (!p) return null;
    if (p.nickname) return String(p.nickname).replace(/^@+/, "").trim();
    if (p.handle) return String(p.handle).replace(/^@+/, "").trim();
    if (p.open_id) return String(p.open_id);
    return null;
  }

  async function handleChallenge(profile) {
    const challengerProfile = me;
    if (!challengerProfile) {
      alert("Please log in or set your profile before challenging another player.");
      nav("/profile");
      return;
    }

    localStorage.setItem("leaderbox_opponent", JSON.stringify(profile));

    try {
      if (SILENT_AUDIO) {
        const s = new Audio(SILENT_AUDIO);
        s.volume = 0;
        await s.play().catch(() => {});
      }
    } catch {}

    const challengerSlug = slugFromProfile(challengerProfile);
    const opponentSlug = slugFromProfile(profile);

    nav(`/duel/play/${encodeURIComponent(challengerSlug)}/${encodeURIComponent(opponentSlug)}`);
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
                  <Avatar src={p.avatar} nickname={p.nickname} size={72} />
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
                  <img
                    src="/play.png"
                    alt="play"
                    style={{ width: 36, height: 36, cursor: "pointer", animation: "subtlePulse 2.5s infinite" }}
                    onClick={() => handleChallenge(p)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes subtlePulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`}</style>
    </div>
  );
}
