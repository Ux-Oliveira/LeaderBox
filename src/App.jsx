// src/App.jsx
import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

// Pages
import Landing from "./components/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Duel from "./pages/Duel";
import Rules from "./pages/Rules";
import ProfilePage from "./pages/ProfilePage";
import ChooseProfile from "./pages/ChooseProfile";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import EditStack from "./pages/EditStack";
import ComingSoon from "./pages/ComingSoon";
import Attribution from "./pages/Attribution";
import TikTokCallback from "./pages/TikTokCallback";
import LetterboxdCallback from "./pages/LetterboxdCallback";

// Components
import NavBar from "./components/NavBar";
import ProfileModal from "./components/ProfileModal";
import Support from "./components/Support";

import Playing from "./pages/Playing";

import { loadProfileFromLocal, saveProfileToLocal } from "./lib/profileLocal";
import { fetchProfileByOpenId } from "./lib/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // Simplified user load logic
    try {
      const raw = localStorage.getItem("stored_profile") || localStorage.getItem("tiktok_profile");
      if (raw) {
        const p = JSON.parse(raw);
        setUser(p);
      }
    } catch {}
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
    nav("/");
  }

  return (
    <div className="app-root">
      <NavBar user={user} onOpenProfile={() => setModalOpen(true)} />

      <div className="bg-gif" aria-hidden="true" />

      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup onSigned={(u, t) => handleLogin(u, t)} />} />
          <Route path="/login" element={<Login onLogin={(u, t) => handleLogin(u, t)} />} />
          <Route path="/duel" element={<Duel />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/pages/EditStack" element={<EditStack user={user} />} />
          <Route path="/auth/tiktok/callback" element={<TikTokCallback />} />
          <Route path="/auth/letterboxd/callback" element={<LetterboxdCallback />} />
          <Route path="/choose-profile" element={<ChooseProfile />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/attribution" element={<Attribution />} />

          {/* NEW: Playing page */}
          <Route path="/duel/play/:challenger/:opponent" element={<Playing />} />
        </Routes>
      </div>

      <ProfileModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        onUpdateUser={(u) => setUser(u)}
      />

      <Support />
    </div>
  );
}
