import React, { useEffect, useState, useRef } from "react";
import { loadProfileFromLocal, clearLocalProfile, saveProfileToLocal } from "../lib/profileLocal";

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

export default function ProfileModal({
  open = false,
  onClose = () => {},
  user = null,
  onLogout = () => {},
  onUpdateUser = () => {}
}) {
  const [isOpen, setOpen] = useState(open);
  const [busyDelete, setBusyDelete] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => setOpen(open), [open]);

  // Persist server-sourced user to localStorage when it changes
  useEffect(() => {
    if (user) saveProfileToLocal(user);
  }, [user]);

  // click outside the modal to close it
  useEffect(() => {
    function handleDocClick(e) {
      if (!isOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        onClose && onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [isOpen, onClose]);

  async function handleServerDelete(open_id) {
    if (!open_id) return false;
    try {
      const res = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) {
        const txt = await res.text();
        console.warn("Delete profile failed:", res.status, txt);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("Delete profile exception:", err);
      return false;
    }
  }

  async function doDeleteProfile() {
    // Confirm destructive action
    if (!confirm("Delete your profile from the site and database? This cannot be undone.")) return;
    setBusyDelete(true);

    const open_id = user && (user.open_id || user.openId || user.raw?.data?.open_id);
    // If user has an actual server-side open_id, attempt server delete
    if (open_id) {
      const ok = await handleServerDelete(open_id);
      if (ok) {
        clearLocalProfile();
        onUpdateUser(null);
        setBusyDelete(false);
        alert("Profile deleted.");
        return;
      } else {
        setBusyDelete(false);
        alert("Failed to delete profile on server. Check console for details.");
        return;
      }
    }

    // Fallback: local-only delete
    clearLocalProfile();
    onUpdateUser(null);
    setBusyDelete(false);
  }

  async function doLogout() {
    clearLocalProfile();
    onLogout();
    onUpdateUser(null);
  }

  if (!user) {
    const localProfile = loadProfileFromLocal();
    return (
      <>
        {/* persistent knob - disappears when modal opens */}
        {!isOpen && (
          <div className="profile-knob" onClick={() => { setOpen(true); onClose && onClose(); }}>
            ?
          </div>
        )}

        <div ref={panelRef} className={`profile-modal ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
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
          <button className="modal-btn" onClick={() => { setOpen(false); onClose && onClose(); }}>Close</button>
        </div>
      </>
    );
  }

  const level = getLevelByWins(user.wins || 0);

  return (
    <>
      {/* persistent knob hides when modal is open */}
      {!isOpen && (
        <div className="profile-knob" onClick={() => setOpen(true)} aria-label="Open profile">
          {/* deliberately plain yellow knob — glare comes from CSS */}
        </div>
      )}

      <div ref={panelRef} className={`profile-modal ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="pfp" style={{ width: 96, height: 96, overflow: "hidden", borderRadius: 999 }}>
              {(user.avatar || user.pfp) ? (
                <img src={user.avatar || user.pfp} alt="pfp" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ padding: 12 }}>{(user.nickname || "U").slice(0, 1).toUpperCase()}</div>
              )}
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
            onClick={doDeleteProfile}
            disabled={busyDelete}
            style={{ background: "#b71c1c" }}
          >
            {busyDelete ? "Deleting…" : "Delete Profile"}
          </button>

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
