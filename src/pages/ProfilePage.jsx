import React, { useEffect, useState } from "react";

export default function ProfilePage({ user: userProp = null }) {
  const [user, setUser] = useState(userProp);

  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      return;
    }
    // Try to load from localStorage (saved by TikTokCallback)
    try {
      const raw = localStorage.getItem("tiktok_profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        // normalize fields if needed
        const normalized = {
          nickname:
            parsed.nickname ||
            parsed.name ||
            (parsed.raw && parsed.raw.data && parsed.raw.data.user && parsed.raw.data.user.display_name) ||
            "TikTok user",
          // prefer avatar then pfp
          pfp:
            parsed.avatar ||
            parsed.pfp ||
            (parsed.raw && parsed.raw.data && parsed.raw.data.user && parsed.raw.data.user.avatar_large) ||
            null,
          raw: parsed.raw || parsed
        };
        setUser(normalized);
      }
    } catch (e) {
      console.warn("Failed reading tiktok_profile from localStorage:", e);
    }
  }, [userProp]);

  if (!user) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Profile</h2>
        <p className="small">No profile loaded. Please log in with TikTok.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{
          width: 96, height: 96, borderRadius: 12, overflow: "hidden", background: "#111",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {(user.avatar || user.pfp) ? (
            <img src={user.avatar || user.pfp} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ color: "#ddd" }}>{(user.nickname || "U").slice(0,1).toUpperCase()}</div>
          )}
        </div>

        <div>
          <h2 style={{ margin: 0 }}>{user.nickname}</h2>
          <div style={{ color: "#999", marginTop: 6 }}>{user.raw?.data?.open_id ? `TikTok id: ${user.raw.data.open_id}` : ""}</div>
          <div style={{ marginTop: 8 }}>
            <button className="modal-btn" onClick={() => { localStorage.removeItem("tiktok_profile"); localStorage.removeItem("tiktok_tokens"); window.location.reload(); }}>
              Log out (local)
            </button>
            <button className="modal-btn" style={{ marginLeft: 8 }} onClick={() => navigator.clipboard?.writeText(JSON.stringify(user.raw || user))}>
              Copy raw profile
            </button>
          </div>
        </div>
      </div>

      <hr style={{ margin: "20px 0", borderColor: "rgba(255,255,255,0.04)" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Profile JSON (truncated)</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 220, overflow: "auto" }}>{JSON.stringify(user.raw || user, null, 2).slice(0, 400)}</pre>
        </div>
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Quick actions</div>
          <div style={{ marginTop: 8 }}>
            <button className="modal-btn" onClick={() => { localStorage.removeItem("tiktok_profile"); localStorage.removeItem("tiktok_tokens"); window.location.reload(); }}>
              Log out (local)
            </button>
            <button className="modal-btn" style={{ marginLeft: 8 }} onClick={() => navigator.clipboard?.writeText(JSON.stringify(user.raw || user))}>
              Copy raw profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
