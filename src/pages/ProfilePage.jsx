import React, { useEffect, useState } from "react";
import { loadProfileFromLocal, clearLocalProfile } from "../lib/profileLocal";
import { useParams, useNavigate } from "react-router-dom";
import Support from "../components/Support";

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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 4) setDeck(parsed);
      }
    } catch (e) {
      console.warn("Failed to load saved deck:", e);
    }
  }, []);

  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      return;
    }

    async function fetchByNickname(slug) {
      setLoadingRemote(true);
      try {
        const res = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, {
          credentials: "same-origin"
        });

        if (res.ok) {
          const data = await res.json();
          const profile = data.profile || data;

          if (profile) {
            const normalized = {
              open_id: profile.open_id,
              nickname: profile.nickname || profile.handle?.replace(/^@/, "") || null,
              avatar: profile.avatar || profile.pfp || null,
              wins: profile.wins || 0,
              losses: profile.losses || 0,
              level: profile.level || 1,
              raw: profile
            };

            setUser(normalized);
            localStorage.setItem("stored_profile", JSON.stringify(normalized));
            setLoadingRemote(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Error fetching profile:", err);
      }
      setLoadingRemote(false);
    }

    if (id) {
      fetchByNickname(id);
      return;
    }

    try {
      const local = loadProfileFromLocal();
      if (local) setUser(local);
    } catch (e) {
      console.warn("Failed reading profile:", e);
    }
  }, [id, userProp]);

  async function handleServerDelete(open_id) {
    if (!open_id) return false;
    try {
      const res = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      return res.ok;
    } catch (err) {
      console.warn("Delete error:", err);
      return false;
    }
  }

  async function deleteProfile() {
    if (!confirm("Delete your profile? This cannot be undone.")) return;
    setBusyDelete(true);

    const open_id = user?.open_id || user?.raw?.data?.open_id;
    if (open_id) {
      const ok = await handleServerDelete(open_id);
      if (ok) {
        clearLocalProfile();
        setUser(null);
        setBusyDelete(false);
        alert("Profile deleted.");
        return;
      }
    }

    clearLocalProfile();
    setUser(null);
    setBusyDelete(false);
  }

  function handleCopyProfileLink(u) {
    if (!u) return;
    const slug =
      (u.nickname && String(u.nickname).replace(/^@/, "").trim()) ||
      u.open_id ||
      "profile";

    const url = `${window.location.origin}/profile/${encodeURIComponent(slug)}`;

    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const posterFor = (movie) => {
    if (!movie) return null;
    if (movie.poster_path) return `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
    if (movie.poster) return movie.poster;
    if (movie.image) return movie.image;
    if (movie.posterUrl) return movie.posterUrl;
    return null;
  };

  if (!user && !loadingRemote)
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Profile</h2>
        <p>No profile loaded.</p>
      </div>
    );

  if (!user && loadingRemote)
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
        <h2>Loading…</h2>
      </div>
    );

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24, position: "relative" }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        {/* FIXED — raw avatar, NO FRAME */}
        <div
          style={{
            width: 96,
            height: 96,
            overflow: "hidden",
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
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
                borderRadius: 999
              }}
            />
          ) : (
            <div style={{ color: "#ddd", fontSize: 32 }}>
              {(user.nickname || "U")[0].toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ margin: 0 }}>{user.nickname}</h2>
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

      <div
        className="profile-stack-block"
        role="button"
        onClick={() => nav("/pages/EditStack")}
      >
        <div className="profile-stack-overlay">
          <div className="slots-row" role="list" style={{ width: "100%", justifyContent: "center" }}>
            {deck.map((m, i) => {
              const poster = posterFor(m);
              return (
                <div key={i} className="movie-slot" style={{ cursor: "pointer" }}>
                  {poster ? (
                    <div className="slot-filled">
                      <img src={poster} alt={m?.title || `movie-${i}`} className="slot-poster" />
                    </div>
                  ) : (
                    <div className="slot-empty" />
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
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="modal-btn"
              onClick={deleteProfile}
              disabled={busyDelete}
              style={{ background: "#b71c1c" }}
            >
              {busyDelete ? "Deleting…" : "Delete Profile"}
            </button>

            <button className="modal-btn" onClick={() => handleCopyProfileLink(user)}>
              Copy profile link
            </button>
          </div>
        </div>
      </div>

      {/* copied toast */}
      {copied && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            top: "20%",
            background: "rgba(0,0,0,0.9)",
            padding: "10px 16px",
            borderRadius: 10,
            zIndex: 9999,
            fontWeight: 800
          }}
        >
          Profile link copied!
        </div>
      )}

      <Support />
    </div>
  );
}
