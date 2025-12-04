// src/App.jsx
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

// NEW: ChooseProfile page (create src/pages/ChooseProfile.jsx as I gave earlier)
import ChooseProfile from "./pages/ChooseProfile";

export default function App() {
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const nav = useNavigate();

  // Try to fetch user profile if token exists; otherwise try localStorage-saved profile
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

    // Fallback: load stored profile from localStorage (saved by TikTokCallback or ProfileModal)
    try {
      const raw = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      if (raw) {
        const p = JSON.parse(raw);

        const normalized = {
          nickname:
            p.nickname ||
            p.raw?.data?.user?.display_name ||
            p.raw?.data?.display_name ||
            "TikTok user",
          pfp: p.pfp || p.raw?.data?.user?.avatar_large || p.raw?.data?.user?.avatar || null,
          email: p.email || "",
          wins: p.wins || 0,
          losses: p.losses || 0,
          raw: p.raw || p,
        };

        setUser(normalized);
      }
    } catch (e) {
      // ignore parse errors
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
    // clear our profile storage keys too
    localStorage.removeItem("tiktok_profile");
    localStorage.removeItem("stored_profile");
    localStorage.removeItem("tiktok_tokens");
    nav("/");
  }

  return (
    <>
      <NavBar user={user} onOpenProfile={() => setModalOpen(true)} />

      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup onSigned={(u, t) => handleLogin(u, t)} />} />
          <Route path="/login" element={<Login onLogin={(u, t) => handleLogin(u, t)} />} />
          <Route path="/duel" element={<Duel />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />

          {/* TikTok OAuth callback */}
          <Route path="/auth/tiktok/callback" element={<TikTokCallback />} />

          {/* NEW: ChooseProfile route — user completes nickname + avatar here */}
          <Route path="/choose-profile" element={<ChooseProfile />} />
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
        <a href="/privacy.html" target="_blank" style={{ color: "#66aaff" }}>
          Privacy Policy
        </a>{" "}
        •{" "}
        <a href="/terms.html" target="_blank" style={{ color: "#66aaff" }}>
          Terms of Service
        </a>
      </footer>
    </>
  );
}
