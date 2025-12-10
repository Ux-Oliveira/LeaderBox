// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { loadProfileFromLocal, clearLocalProfile } from "../lib/profileLocal";
import { useParams, useNavigate } from "react-router-dom";

const STORAGE_KEY = "leaderbox_deck_v1";

export default function ProfilePage({ user: userProp = null }) {
  const { id } = useParams();
  const [user, setUser] = useState(userProp);
  const [busyDelete, setBusyDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [deck, setDeck] = useState([null, null, null, null]);
  const nav = useNavigate();

  useEffect(() => {
    try {
      if (userProp && Array.isArray(userProp.deck) && userProp.deck.length === 4) {
        setDeck(userProp.deck);
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 4) setDeck(parsed);
      }
    } catch (e) {
      console.warn("Failed to load saved deck:", e);
    }
  }, [userProp]);

  useEffect(() => {
    function onProfileChange(e) {
      const newUser = e?.detail?.user ?? null;
      setUser(newUser);
      if (newUser && Array.isArray(newUser.deck) && newUser.deck.length === 4) setDeck(newUser.deck);
    }
    window.addEventListener("leaderbox:profile-changed", onProfileChange);
    return () => window.removeEventListener("leaderbox:profile-changed", onProfileChange);
  }, []);

  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      if (Array.isArray(userProp.deck) && userProp.deck.length === 4) {
        setDeck(userProp.deck);
      } else {
        (async () => {
          const uid = userProp.open_id || userProp.id || userProp.openId || null;
          if (!uid) return;
          try {
            const res = await fetch(`/api/profile?open_id=${encodeURIComponent(uid)}`, { credentials: "same-origin" });
            if (res.ok) {
              const text = await res.text();
              try {
                const json = JSON.parse(text);
                const profile = json.profile || json;
                if (profile && Array.isArray(profile.deck) && profile.deck.length === 4) setDeck(profile.deck);
                const normalized = {
                  open_id: profile?.open_id || userProp.open_id || userProp.id,
                  nickname: profile?.nickname || userProp.nickname || userProp.handle,
                  avatar: profile?.avatar || userProp.avatar || userProp.pfp,
                  wins: profile?.wins || userProp.wins || 0,
                  losses: profile?.losses || userProp.losses || 0,
                  draws: profile?.draws || userProp.draws || 0,
                  level: profile?.level || userProp.level || 1,
                  deck: profile?.deck || userProp.deck || []
                };
                try { localStorage.setItem("stored_profile", JSON.stringify(normalized)); } catch (e) {}
              } catch (e) { /* ignore parse */ }
            }
          } catch (err) { console.warn("Failed to refresh profile deck:", err); }
        })();
      }
      return;
    }

    async function fetchByNickname(slug) {
      setLoadingRemote(true);
      try {
        const res = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            const profile = data.profile || data;
            if (profile && (profile.nickname || profile.open_id)) {
              const normalized = {
                open_id: profile.open_id,
                nickname: profile.nickname || (profile.handle ? profile.handle.replace(/^@/, "") : null),
                avatar: profile.avatar || profile.pfp || null,
                wins: profile.wins || 0,
                losses: profile.losses || 0,
                draws: profile.draws || 0,
                level: profile.level || 1,
                deck: Array.isArray(profile.deck) ? profile.deck : [],
                raw: profile
              };
              setUser(normalized);
              if (Array.isArray(profile.deck) && profile.deck.length === 4) setDeck(profile.deck);
              try { localStorage.setItem("stored_profile", JSON.stringify(normalized)); } catch (e) {}
              setLoadingRemote(false);
              return;
            }
          } catch (e) { /* ignore */ }
        }

        // fallback by open_id
        const fallbackRes = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
        if (fallbackRes.ok) {
          const txt = await fallbackRes.text();
          try {
            const d2 = JSON.parse(txt);
            const profile2 = d2.profile || d2;
            if (profile2) {
              const normalized2 = {
                open_id: profile2.open_id,
                nickname: profile2.nickname || profile2.handle || null,
                avatar: profile2.avatar || profile2.pfp || null,
                wins: profile2.wins || 0,
                losses: profile2.losses || 0,
                draws: profile2.draws || 0,
                level: profile2.level || 1,
                deck: Array.isArray(profile2.deck) ? profile2.deck : [],
                raw: profile2
              };
              setUser(normalized2);
              if (Array.isArray(profile2.deck) && profile2.deck.length === 4) setDeck(profile2.deck);
              try { localStorage.setItem("stored_profile", JSON.stringify(normalized2)); } catch (e) {}
              setLoadingRemote(false);
              return;
            }
          } catch (e) { /* ignore parse */ }
        }
      } catch (err) {
        console.warn("Error fetching profile by nickname:", err);
      } finally { setLoadingRemote(false); }
    }

    if (id) {
      fetchByNickname(id);
      return;
    }

    try {
      const local = loadProfileFromLocal();
      if (local) {
        setUser(local);
        if (Array.isArray(local.deck) && local.deck.length === 4) setDeck(local.deck);
      }
    } catch (e) { console.warn("Failed reading profile from localStorage:", e); }

  }, [id, userProp]);

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
        window.dispatchEvent(new CustomEvent("leaderbox:profile-changed", { detail: { user: null } }));
        setBusyDelete(false);
        alert("Profile deleted.");
        nav("/");
        return;
      } else {
        setBusyDelete(false);
        alert("Failed to delete profile on server. Check console for details.");
        return;
      }
    }
    clearLocalProfile();
    setUser(null);
    window.dispatchEvent(new CustomEvent("leaderbox:profile-changed", { detail: { user: null } }));
    setBusyDelete(false);
    nav("/");
  }

  function handleCopyProfileLink(u) {
    if (!u) return;
    const slug = (u.nickname && String(u.nickname).replace(/^@/, "").trim()) || u.open_id || "profile";
    const url = `${window.location.origin}/profile/${encodeURIComponent(slug)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {
        try {
          const ta = document.createElement("textarea");
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch (e) {
          alert("Unable to copy link.");
        }
      });
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch (e) {
        alert("Unable to copy link.");
      }
    }
  }

  function handleStackClick() {
    nav("/pages/EditStack");
  }

  if (!user && !loadingRemote) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Hold on...</h2>
        <p className="small">No profile loaded. Signup or log in on the profile side menu if you're on your phone or in the buttons above on desktop.</p>
      </div>
    );
  }

  if (!user && loadingRemote) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Loading profile…</h2>
      </div>
    );
  }

  function posterFor(movie) {
    if (!movie) return null;
    if (movie.poster_path) return `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
    if (movie.poster) return movie.poster;
    if (movie.image) return movie.image;
    if (movie.posterUrl) return movie.posterUrl;
    if (movie.raw && movie.raw.poster_path) return `https://image.tmdb.org/t/p/w342${movie.raw.poster_path}`;
    if (movie.raw && movie.raw.poster) return movie.raw.poster;
    return null;
  }

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24, position: "relative" }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ width: 120, height: 120, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", boxShadow: "none", borderRadius: 0, padding: 0 }}>
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", border: "none", boxShadow: "none", borderRadius: 0, background: "transparent" }} />
          ) : (
            <div style={{ color: "#ddd", fontSize: 32 }}>{(user?.nickname || "U").slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{user.nickname}</h2>
          <div style={{ marginTop: 8 }}>
            <button className="modal-btn" onClick={() => { clearLocalProfile(); window.dispatchEvent(new CustomEvent("leaderbox:profile-changed", { detail: { user: null } })); window.location.reload(); }} > Log out </button>
          </div>
        </div>
      </div>

      <hr style={{ margin: "20px 0", borderColor: "rgba(255,255,255,0.04)" }} />

      <div className="profile-stack-block" role="button" onClick={handleStackClick} aria-label="Open Edit Stack" title="Click to edit your stack" >
        <div className="profile-stack-overlay">
          <div className="slots-row" role="list" style={{ width: "100%", justifyContent: "center" }}>
            {deck.map((m, i) => {
              const poster = posterFor(m);
              return (
                <div key={i} className="movie-slot" style={{ cursor: "pointer" }}>
                  {poster ? (
                    <div className="slot-filled" aria-hidden>
                      <img src={poster} alt={m.title || m.name || `movie-${i}`} className="slot-poster" />
                    </div>
                  ) : (
                    <div className="slot-empty" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Your progress</div>
          <div style={{ marginTop: 8 }}>
            <div><strong>Nickname:</strong> {user.nickname}</div>
            <div><strong>Wins:</strong> {user.wins || 0}</div>
            <div><strong>Losses:</strong> {user.losses || 0}</div>
            <div><strong>Draws:</strong> {user.draws || 0}</div>
            <div><strong>Level:</strong> {user.level || 1}</div>
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Actions</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="modal-btn" onClick={deleteProfile} disabled={busyDelete} style={{ background: "#b71c1c" }}>
              {busyDelete ? "Deleting…" : "Delete Your Profile"}
            </button>
            <button className="modal-btn" onClick={() => handleCopyProfileLink(user)} > Share your profile (Copy Link) </button>
          </div>
        </div>
      </div>

      {copied && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: "20%", background: "rgba(0,0,0,0.9)", padding: "10px 16px", borderRadius: 10, zIndex: 9999, fontWeight: 800 }}>
          Profile link copied to clipboard!
        </div>
      )}
    </div>
  );
}
