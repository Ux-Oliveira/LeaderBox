// src/components/ProfileModal.jsx
import React, { useEffect, useState } from "react";

// level helpers omitted for brevity if you keep them elsewhere
const LEVELS = [
  { level: 1, name: "Noob", threshold: 0 },
  { level: 2, name: "Casual Viewer", threshold: 5 },
  { level: 3, name: "Youtuber Movie Critic", threshold: 11 },
  { level: 4, name: "Movie Festival Goer", threshold: 18 },
  { level: 5, name: "Indie Afficionado", threshold: 26 },
  { level: 6, name: "Cult Classics Schoolar", threshold: 35 },
  { level: 7, name: "Film Buff", threshold: 45 },
  { level: 8, name: "Film Curator", threshold: 56 },
  { level: 9, name: "Cinephile", threshold: 68 }
];

function getLevelByWins(wins) {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (wins >= LEVELS[i].threshold) {
      current = LEVELS[i];
      break;
    }
  }
  return current;
}

const LOCAL_KEY = "stored_profile";

export function saveProfileToLocal(p) {
  try {
    const safe = {
      open_id: p.open_id || (p.raw && p.raw.data && p.raw.data.open_id) || null,
      handle:
        p.handle ||
        (p.raw && p.raw.data && p.raw.data.user && (p.raw.data.user.unique_id || p.raw.data.user.display_name)) ||
        p.nickname ||
        null,
      nickname: p.nickname || (p.handle && p.handle.replace(/^@/, "")) || "TikTok user",
      pfp: p.pfp || p.avatar || null,
      wins: Number.isFinite(p.wins) ? p.wins : 0,
      losses: Number.isFinite(p.losses) ? p.losses : 0,
      level: Number.isFinite(p.level) ? p.level : 1,
      deck: Array.isArray(p.deck) ? p.deck : [],
      raw: p.raw || p,
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
    localStorage.setItem("tiktok_profile", JSON.stringify(safe));
  } catch (e) {
    console.warn("Failed saving profile:", e);
  }
}

export function loadProfileFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY) || localStorage.getItem("tiktok_profile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearLocalProfile() {
  try {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem("tiktok_tokens");
  } catch (e) {}
}

export default function ProfileModal({
  open = false,
  onClose = () => {},
  user = null,
  onLogout = () => {},
  onUpdateUser = () => {}
}) {
  // --- ALL hooks MUST be declared at the top-level, unconditionally ---
  const [isOpen, setOpen] = useState(open);

  // mirror `open` prop
  useEffect(() => setOpen(open), [open]);

  // always keep server-sourced user saved into localStorage when it changes
  useEffect(() => {
    if (user) saveProfileToLocal(user);
  }, [user]);

  // (optional) placeholder effect — kept minimal and not conditional
  useEffect(() => {
    // no-op or debug only
  }, []);

  // --- component helpers (no hooks below) ---
  async function doLogout() {
    clearLocalProfile();
    onLogout();
    onUpdateUser(null);
  }

  // If no user — show login/signup CTA
  if (!user) {
    const localProfile = loadProfileFromLocal();
    return (
      <>
        <div className="profile-knob" onClick={() => { setOpen(true); onClose && onClose(); }}>
          ?
        </div>

        <div className={`profile-modal ${isOpen ? "open" : ""}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "var(--accent)" }}>Profile</div>
            <div className="small">You must login to view profile</div>

            {localProfile ? (
              <>
                <div className="small">Found a saved profile. Use it to preview your account locally.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="modal-btn"
                    onClick={() => {
                      onUpdateUser(localProfile);
                      setOpen(false);
                    }}
                  >
                    Use saved profile
                  </button>
                  <button
                    className="modal-btn"
                    onClick={() => {
                      clearLocalProfile();
                      setOpen(false);
                    }}
                  >
                    Clear saved profile
                  </button>
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="modal-btn" onClick={() => (window.location.href = "/login")}>Log in</button>
              <button className="modal-btn" onClick={() => (window.location.href = "/signup")}>Sign up</button>
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <button className="modal-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      </>
    );
  }

  // Have a user — normal UI
  const level = getLevelByWins(user.wins || 0);

  return (
    <>
      <div className="profile-knob" onClick={() => setOpen(!isOpen)}>{isOpen ? "<" : ">"}</div>
      <div className={`profile-modal ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="pfp" style={{ width: 64, height: 64, overflow: "hidden", borderRadius: 12 }}>
              {user.pfp ? <img src={user.pfp} alt="pfp" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 12 }}>{(user.nickname || "U").slice(0, 1).toUpperCase()}</div>}
            </div>
            <div>
              <div style={{ fontWeight: 900, color: "var(--accent)" }}>{user.nickname}</div>
              <div className="small">{user.email || ""}</div>
            </div>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.04)" }} />

          <button className="modal-btn" onClick={() => (window.location.href = "/profile")}>Edit Stack</button>

          <div style={{ padding: "8px", borderRadius: 8, background: "rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="small">Wins</div>
              <div className="small">{user.wins || 0}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="small">Losses</div>
              <div className="small">{user.losses || 0}</div>
            </div>
          </div>

          <button
            className="modal-btn"
            onClick={() => {
              const newUser = { ...user, nickname: user.nickname || "User" };
              saveProfileToLocal(newUser);
              onUpdateUser(newUser);
            }}
          >
            Change pfp
          </button>

          <button className="modal-btn">Change Password</button>
          <button className="modal-btn" onClick={() => { clearLocalProfile(); onUpdateUser(null); }}>Delete Profile</button>

          <hr style={{ borderColor: "rgba(255,255,255,0.04)" }} />

          <div>
            <div className="small" style={{ color: "var(--accent)" }}>Level {level.level} - {level.name}</div>
            <div className="level-bar" style={{ marginTop: 8 }}>
              {LEVELS.map(l => (
                <div key={l.level} className="level-pill" style={{ background: (l.level === level.level) ? "var(--accent)" : "transparent", color: (l.level === level.level) ? "var(--black)" : "var(--white)" }}>{l.level}</div>
              ))}
            </div>
          </div>
        </div>

        <button className="modal-btn" onClick={doLogout}>Logout</button>
      </div>
    </>
  );
}
