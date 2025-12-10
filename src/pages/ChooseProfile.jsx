import React, { useEffect, useState } from "react";
import { saveProfileToLocal } from "../lib/profileLocal";

const AVATAR_COUNT = 8;
const AVATAR_BASE = "/assets/avatars"; // avatar1..avatar8 exist

function isNicknameValid(n) {
  if (!n) return false;
  const cleaned = String(n).trim().replace(/^@/, "");
  return /^[A-Za-z0-9_\-]{3,30}$/.test(cleaned);
}

export default function ChooseProfile() {
  const [openId, setOpenId] = useState(null);
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tiktok_profile");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !parsed.open_id) {
        setError("Missing open_id — please log in again.");
        return;
      }
      setOpenId(parsed.open_id);
      if (parsed.nickname) setNickname(String(parsed.nickname).replace(/^@/, ""));
      if (parsed.avatar) setSelectedAvatar(parsed.avatar);
    } catch (e) {
      setError("Failed reading local profile. Please log in again.");
    }
  }, []);

  const avatars = Array.from({ length: AVATAR_COUNT }, (_, i) => `${AVATAR_BASE}/avatar${i + 1}.png`);

  async function submit() {
    setError("");
    if (!openId) return setError("Missing open_id");
    if (!isNicknameValid(nickname)) return setError("Invalid nickname (3-30 chars: letters, numbers, -, _).");
    if (!selectedAvatar) return setError("Please choose an avatar.");
    setBusy(true);

    try {
      const payload = {
        open_id: openId,
        nickname: nickname, // server will sanitize and prefix
        avatar: selectedAvatar,
      };
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || text || `Server error ${res.status}`;
        setError(String(msg));
        setBusy(false);
        return;
      }

      const profile = (data && data.profile) ? data.profile : data;
      if (profile) {
        // Normalize nickname to store client-side WITHOUT leading '@'
        const cleaned = profile.nickname ? String(profile.nickname).replace(/^@/, "") : null;
        const safe = {
          open_id: profile.open_id || openId,
          nickname: cleaned,
          avatar: profile.avatar || selectedAvatar,
          wins: profile.wins || 0,
          losses: profile.losses || 0,
          level: profile.level || 1,
          deck: Array.isArray(profile.deck) ? profile.deck : [],
        };
        // Save normalized safe profile locally
        saveProfileToLocal(safe);
        // Also set tiktok_profile in case other code reads it
        localStorage.setItem("tiktok_profile", JSON.stringify(safe));
        // Redirect to home (client App will fetch server profile on mount too)
        window.location.href = "/";
      } else {
        setError("No profile returned from server.");
        setBusy(false);
      }
    } catch (err) {
      console.error("Complete profile failed:", err);
      setError(String(err.message || err));
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 740, margin: "40px auto", padding: 20 }}>
      <h2>Complete your account</h2>
      <p>Please choose a unique nickname and pick one avatar. You can't change your nickname later.</p>

      {error && <div style={{ color: "#a00", marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#222", padding: "8px 12px", borderRadius: 6, color: "#ddd" }}>@</div>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.replace(/\s+/g, ""))}
            placeholder="Choose a unique name (3-30 chars, letters/numbers/_/-)"
            disabled={busy}
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#0f0f0f", color: "#fff" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>Choose an avatar</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {avatars.map((src) => (
            <div
              key={src}
              onClick={() => setSelectedAvatar(src)}
              style={{
                border: selectedAvatar === src ? "3px solid #ffd166" : "2px solid rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0b0b0b"
              }}
            >
              {/* image shown raw (no rounded frame) as requested */}
              <img src={src} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 0 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={busy} className="modal-btn">
          {busy ? "Saving…" : "Complete account"}
        </button>
        <button onClick={() => { localStorage.removeItem("tiktok_profile"); localStorage.removeItem("tiktok_tokens"); window.location.href = "/"; }} className="modal-btn" style={{ background: "#333" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
