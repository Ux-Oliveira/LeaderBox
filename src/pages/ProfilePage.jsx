import React, { useEffect, useState } from "react";
import { loadProfileFromLocal, clearLocalProfile } from "../lib/profileLocal";
import { useParams, useNavigate } from "react-router-dom";

const STORAGE_KEY = "leaderbox_deck_v1";

/*
  ProfilePage now accepts an optional :id URL param.
  If :id is present we try to fetch that profile from the server (by nickname),
  otherwise we load the local profile (same behavior as before).
*/

export default function ProfilePage({ user: userProp = null }) {
  const { id } = useParams(); // id is the slug (nickname without @) when visiting /profile/:id
  const [user, setUser] = useState(userProp);
  const [busyDelete, setBusyDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [deck, setDeck] = useState([null, null, null, null]);
  const nav = useNavigate();

  useEffect(() => {
    // load deck from localStorage if present
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 4) {
          setDeck(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load saved deck:", e);
    }
  }, []);

  useEffect(() => {
    // Listen for global profile changes so we update UI if another component deletes/logs out
    function onProfileChange(e) {
      const newUser = e?.detail?.user ?? null;
      setUser(newUser);
    }
    window.addEventListener("leaderbox:profile-changed", onProfileChange);
    return () => window.removeEventListener("leaderbox:profile-changed", onProfileChange);
  }, []);

  useEffect(() => {
    // If parent passed a userProp (e.g. logged-in), prefer that immediately.
    if (userProp) {
      setUser(userProp);
      return;
    }

    async function fetchByNickname(slug) {
      setLoadingRemote(true);
      try {
        // Attempt server endpoint that looks up by nickname first.
        // Your server should support something like: GET /api/profile?nickname=rick
        const res = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          // server shape: { ok: true, profile: { ... } } OR direct profile object
          const profile = data.profile || data;
          if (profile && (profile.nickname || profile.open_id)) {
            const normalized = {
              open_id: profile.open_id,
              nickname: profile.nickname || (profile.handle ? profile.handle.replace(/^@/, "") : null),
              avatar: profile.avatar || profile.pfp || null,
              wins: profile.wins || 0,
              losses: profile.losses || 0,
              level: profile.level || 1,
              raw: profile
            };
            setUser(normalized);
            // also save locally so modal / other flows can use it
            try { localStorage.setItem("stored_profile", JSON.stringify(normalized)); } catch (e) {}
            setLoadingRemote(false);
            return;
          }
        } else {
          // if server returned 404 or not ok, try fallback by open_id (in case id is raw TikTok id)
          const fallbackRes = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
          if (fallbackRes.ok) {
            const d2 = await fallbackRes.json();
            const profile2 = d2.profile || d2;
            if (profile2) {
              const normalized2 = {
                open_id: profile2.open_id,
                nickname: profile2.nickname || profile2.handle || null,
                avatar: profile2.avatar || profile2.pfp || null,
                wins: profile2.wins || 0,
                losses: profile2.losses || 0,
                level: profile2.level || 1,
                raw: profile2
              };
              setUser(normalized2);
              try { localStorage.setItem("stored_profile", JSON.stringify(normalized2)); } catch (e) {}
              setLoadingRemote(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Error fetching profile by nickname:", err);
      }
      setLoadingRemote(false);
    }

    if (id) {
      // if URL param present, try fetching that profile
      fetchByNickname(id);
      return;
    }

    try {
      const local = loadProfileFromLocal();
      if (local) setUser(local);
    } catch (e) {
      console.warn("Failed reading profile from localStorage:", e);
    }
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
        // broadcast to rest of app
        window.dispatchEvent(new CustomEvent("leaderbox:profile-changed", { detail: { user: null } }));
        setBusyDelete(false);
        alert("Profile deleted.");
        // optional: navigate to home
        nav("/");
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
    window.dispatchEvent(new CustomEvent("leaderbox:profile-changed", { detail: { user: null } }));
    setBusyDelete(false);
    // optional: navigate to home
    nav("/");
  }

  function handleCopyProfileLink(u) {
    if (!u) return;
    // prefer nickname slug for shareable URL; fall back to open_id if no nickname
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

  // Navigate to EditStack when clicking the stack bar
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

  // while loading remote profile show small spinner/placeholder
  if (!user && loadingRemote) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Loading profile…</h2>
      </div>
    );
  }

  // helper to render poster thumbnail safely
  function posterFor(movie) {
    if (!movie) return null;
    // common shapes: movie.poster_path (TMDB), movie.poster, movie.image, movie.posterUrl
    if (movie.poster_path) {
      // TMDB path
      return `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
    }
    if (movie.poster) return movie.poster;
    if (movie.image) return movie.image;
    if (movie.posterUrl) return movie.posterUrl;
    // try nested raw paths
    if (movie.raw && movie.raw.poster_path) return `https://image.tmdb.org/t/p/w342${movie.raw.poster_path}`;
    if (movie.raw && movie.raw.poster) return movie.raw.poster;
    return null;
  }

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24, position: "relative" }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div
          style={{
            width: 120,
            height: 120,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            boxShadow: "none",
            borderRadius: 0,
            padding: 0,
          }}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt="avatar"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                border: "none",
                boxShadow: "none",
                borderRadius: 0,
                background: "transparent"
              }}
            />
          ) : (
            <div style={{ color: "#ddd", fontSize: 32 }}>{(user?.nickname || "U").slice(0, 1).toUpperCase()}</div>
          )}
        </div>

        <div>
          <h2 style={{ margin: 0 }}>{user.nickname}</h2>
          {/* TikTok id intentionally hidden (requested) */}
          <div style={{ marginTop: 8 }}>
            <button
              className="modal-btn"
              onClick={() => {
                clearLocalProfile();
                // broadcast change and reload so app-wide state resets
                window.dispatchEvent(new CustomEvent("leaderbox:profile-changed", { detail: { user: null } }));
                window.location.reload();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <hr style={{ margin: "20px 0", borderColor: "rgba(255,255,255,0.04)" }} />

      {/* ======= STACK BAR (clickable) ======= */}
      <div
        className="profile-stack-block"
        role="button"
        onClick={handleStackClick}
        aria-label="Open Edit Stack"
        title="Click to edit your stack"
      >
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
      {/* ======= end stack bar ======= */}

      <div style={{ height: 18 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Your progress</div>
          <div style={{ marginTop: 8 }}>
            <div><strong>Nickname:</strong> {user.nickname}</div>
            <div><strong>Wins:</strong> {user.wins || 0}</div>
            <div><strong>Losses:</strong> {user.losses || 0}</div>
            <div><strong>Level:</strong> {user.level || 1}</div>
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
          <div className="small" style={{ color: "#999" }}>Actions</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="modal-btn"
              onClick={deleteProfile}
              disabled={busyDelete}
              style={{ background: "#b71c1c" }}
            >
              {busyDelete ? "Deleting…" : "Delete Your Profile"}
            </button>

            <button
              className="modal-btn"
              onClick={() => handleCopyProfileLink(user)}
            >
              Share your profile (Copy Link)
            </button>
          </div>
        </div>
      </div>

      {/* transient toast/modal for copied */}
      {copied && (
        <div style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          top: "20%",
          background: "rgba(0,0,0,0.9)",
          padding: "10px 16px",
          borderRadius: 10,
          zIndex: 9999,
          fontWeight: 800
        }}>
          Profile link copied to clipboard!
        </div>
      )}
    </div>
  );
}
