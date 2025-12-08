import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

// Components
import NavBar from "./components/NavBar";
import Landing from "./components/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Duel from "./pages/Duel";
import Rules from "./pages/Rules";
import ProfilePage from "./pages/ProfilePage";
import ProfileModal from "./components/ProfileModal";
import TikTokCallback from "./pages/TikTokCallback"; // TikTok OAuth callback
import ChooseProfile from "./pages/ChooseProfile";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

import { loadProfileFromLocal, saveProfileToLocal } from "./lib/profileLocal";
import { fetchProfileByOpenId } from "./lib/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("md_token");

    if (token) {
      fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Not authenticated");
          return res.json();
        })
        .then((u) => setUser(u.user))
        .catch(() => localStorage.removeItem("md_token"));

      return;
    }

    try {
      const raw = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      if (raw) {
        const p = JSON.parse(raw);

        const normalized = {
          open_id: p.open_id || p.openId || (p.raw && p.raw.data?.open_id) || null,
          nickname:
            p.nickname ||
            (p.raw && (p.raw.data?.user?.display_name || p.raw.data?.display_name)) ||
            null,
          pfp: p.pfp || p.avatar || (p.raw && (p.raw.data?.user?.avatar || null)) || null,
          email: p.email || "",
          wins: p.wins || 0,
          losses: p.losses || 0,
          level: p.level || 1,
          raw: p.raw || p,
        };

        setUser(normalized);

        if (normalized.open_id) {
          (async () => {
            try {
              const resp = await fetchProfileByOpenId(normalized.open_id);
              if (resp.ok && resp.profile) {
                const server = resp.profile;
                const cleaned = server.nickname ? String(server.nickname).replace(/^@/, "") : null;
                const safe = {
                  open_id: server.open_id,
                  nickname: cleaned,
                  avatar: server.avatar || server.pfp || normalized.pfp,
                  wins: server.wins || 0,
                  losses: server.losses || 0,
                  level: server.level || 1,
                  deck: Array.isArray(server.deck) ? server.deck : [],
                };
                saveProfileToLocal(safe);
                setUser({
                  open_id: safe.open_id,
                  nickname: safe.nickname,
                  pfp: safe.avatar,
                  wins: safe.wins,
                  losses: safe.losses,
                  level: safe.level,
                });
              }
            } catch (e) {
              console.warn("Failed to refresh server profile:", e);
            }
          })();
        }

        return;
      }
    } catch (e) {
      console.warn("Failed to parse stored profile:", e);
    }
  }, []);

  function handleLogin(userObj, token) {
    setUser(userObj);
    if (token) localStorage.setItem("md_token", token);
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("md_token");
    localStorage.removeItem("tiktok_profile");
    localStorage.removeItem("stored_profile");
    localStorage.removeItem("tiktok_tokens");
    nav("/");
  }

  return (
    <>
      <NavBar user={user} onOpenProfile={() => setModalOpen(true)} />

      {/* Single persistent background GIF for the entire app */}
      <div className="bg-gif" aria-hidden="true" />

      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup onSigned={(u, t) => handleLogin(u, t)} />} />
          <Route path="/login" element={<Login onLogin={(u, t) => handleLogin(u, t)} />} />
          <Route path="/duel" element={<Duel />} />
          <Route path="/rules" element={<Rules />} />

          {/* profile — local/current user */}
          <Route path="/profile" element={<ProfilePage user={user} />} />
          {/* shareable profile links */}
          <Route path="/profile/:id" element={<ProfilePage />} />

          {/* TikTok OAuth callback */}
          <Route path="/auth/tiktok/callback" element={<TikTokCallback />} />

          {/* ChooseProfile */}
          <Route path="/choose-profile" element={<ChooseProfile />} />

          {/* NEW */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </div>

      <ProfileModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        onUpdateUser={(u) => setUser(u)}
      />

      <footer
        style={{
          marginTop: "60px",
          padding: "20px",
          textAlign: "center",
          color: "#888",
          fontSize: "14px",
        }}
      >
        <br />
      </footer>
    </>
  );
}
