import React, { useEffect, useState } from "react";
import { loadProfileFromLocal, clearLocalProfile } from "../lib/profileLocal";

export default function ProfilePage({ user: userProp = null }) {
  const [user, setUser] = useState(userProp);
  const [busyDelete, setBusyDelete] = useState(false);

  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      return;
    }
    try {
      const local = loadProfileFromLocal();
      if (local) setUser(local);
    } catch (e) {
      console.warn("Failed reading profile from localStorage:", e);
    }
  }, [userProp]);

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

  async function deleteProfile() {
    if (!confirm("Delete your profile from the site and database? This cannot be undone.")) return;
    setBusyDelete(true);

    const open_id = user && (user.open_id || user.openId || user.raw?.data?.open_id);
    if (open_id) {
      const ok = await handleServerDelete(open_id);
      if (ok) {
        clearLocalProfile();
        setUser(null);
        setBusyDelete(false);
        alert("Profile deleted.");
        return;
      } else {
        setBusyDelete(false);
        alert("Failed to delete profile on server. Check console for details.");
        return;
      }
    }

    // local-only
    clearLocalProfile();
    setUser(null);
    setBusyDelete(false);
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Profile</h2>
        <p className="small">No profile loaded. Please log in with TikTok and complete your account.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            overflow: "hidden",
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {user.avatar ? (
            <img src={user.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ color: "#ddd", fontSize: 32 }}>{(user.nickname || "U").slice(0, 1).toUpperCase()}</div>
          )}
        </div>

        <div>
          <h2 style={{ margin: 0 }}>{user.nickname}</h2>
          <div style={{ color: "#999", marginTop: 6 }}>{user.open_id ? `TikTok id: ${user.open_id}` : ""}</div>
          <div style={{ marginTop: 8 }}>
            <button
              className="modal-btn"
              onClick={() => {
                clearLocalProfile();
                window.location.reload();
              }}
            >
              Log out (local)
            </button>
          </div>
        </div>
      </div>

      <hr style={{ margin: "20px 0", borderColor: "rgba(255,255,255,0.04)" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Account</div>
          <div style={{ marginTop: 8 }}>
            <div><strong>Nickname:</strong> {user.nickname}</div>
            <div><strong>Wins:</strong> {user.wins || 0}</div>
            <div><strong>Losses:</strong> {user.losses || 0}</div>
            <div><strong>Level:</strong> {user.level || 1}</div>
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Actions</div>
          <div style={{ marginTop: 8 }}>
            <button
              className="modal-btn"
              onClick={deleteProfile}
              disabled={busyDelete}
              style={{ background: "#b71c1c" }}
            >
              {busyDelete ? "Deleting…" : "Delete Profile (delete from server if exists)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
