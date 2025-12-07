// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { loadProfileFromLocal, clearLocalProfile } from "../lib/profileLocal";
import { deleteProfile as apiDeleteProfile } from "../lib/api";

export default function ProfilePage({ user: userProp = null }) {
  const [user, setUser] = useState(userProp);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

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

  async function handleDelete() {
    setError("");
    if (!user || !user.open_id) {
      clearLocalProfile();
      window.location.reload();
      return;
    }
    const confirm = window.confirm("Delete your profile from the site? This action cannot be undone.");
    if (!confirm) return;
    setDeleting(true);
    try {
      const resp = await apiDeleteProfile(user.open_id);
      if (!resp.ok) {
        setError(String(resp.error || "Failed to delete profile"));
        setDeleting(false);
        return;
      }
      clearLocalProfile();
      window.location.href = "/";
    } catch (e) {
      console.error("Failed to delete profile:", e);
      setError(String(e.message || e));
    } finally {
      setDeleting(false);
    }
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
          <h2 style={{ margin: 0 }}>{user.nickname ? (user.nickname.startsWith("@") ? user.nickname : `@${user.nickname}`) : "TikTok user"}</h2>
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
            <div><strong>Nickname:</strong> {user.nickname ? (user.nickname.startsWith("@") ? user.nickname : `@${user.nickname}`) : "—"}</div>
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
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Profile (remove from site)"}
            </button>
            {error && <div style={{ color: "#a00", marginTop: 8 }}>{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
