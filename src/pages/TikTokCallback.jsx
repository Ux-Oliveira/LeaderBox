ok now... 💥 WHY YOUR PROFILE POPUP STILL DOESN’T SHOW

Because your frontend is still trying to fetch the profile from a WRONG URL.

You need to confirm this immediately:

Go to your frontend code (App.jsx or NavBar or ProfileModal)

Search for ANY of these wrong URLs:

/profile
https://leaderbox.co/profile


They need to be replaced with the correct one:

/api/profile - cool got it but i never made an api file for profile.js it was alwasy in server/routes/ so whatever if it needs to go to the api folder ill change it but i dont think that´s the issue right? my server holds profile.js: // server/routes/profile.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// routes is under server/, so users.json lives at server/users.json
const USERS_PATH = path.join(__dirname, "../users.json");

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}
function saveUsers(users) {
  // write atomically: temp file then rename (safer)
  const tmp = USERS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { encoding: "utf8" });
  fs.renameSync(tmp, USERS_PATH);
}

const router = express.Router();

// List all profiles (GET /api/profile)
router.get("/", (req, res) => {
  const users = loadUsers();
  return res.json({ ok: true, profiles: users });
});

// Get single profile (GET /api/profile/:open_id)
router.get("/:open_id", (req, res) => {
  const { open_id } = req.params;
  const users = loadUsers();
  const user = users.find(u => u.open_id === open_id);
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true, profile: user });
});

// Create or update profile (POST /api/profile)
router.post("/", (req, res) => {
  try {
    const { open_id, nickname, avatar, wins, losses, level, deck } = req.body;
    if (!open_id) return res.status(400).json({ error: "Missing open_id" });

    const users = loadUsers();
    let user = users.find(u => u.open_id === open_id);

    if (!user) {
      user = {
        open_id,
        nickname: nickname || `@${open_id}`,
        avatar: avatar || null,
        wins: Number.isFinite(wins) ? parseInt(wins, 10) : 0,
        losses: Number.isFinite(losses) ? parseInt(losses, 10) : 0,
        level: Number.isFinite(level) ? parseInt(level, 10) : 1,
        deck: Array.isArray(deck) ? deck : [],
        created_at: Date.now(),
        updated_at: Date.now()
      };
      users.push(user);
    } else {
      // update allowed fields
      if (typeof nickname !== "undefined") user.nickname = nickname;
      if (typeof avatar !== "undefined") user.avatar = avatar;
      if (typeof wins !== "undefined") user.wins = Number.isFinite(wins) ? parseInt(wins, 10) : user.wins;
      if (typeof losses !== "undefined") user.losses = Number.isFinite(losses) ? parseInt(losses, 10) : user.losses;
      if (typeof level !== "undefined") user.level = Number.isFinite(level) ? parseInt(level, 10) : user.level;
      if (typeof deck !== "undefined") user.deck = Array.isArray(deck) ? deck : user.deck;
      user.updated_at = Date.now();
    }

    saveUsers(users);
    return res.json({ ok: true, profile: user });
  } catch (err) {
    console.error("profile route error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

// Delete profile (DELETE /api/profile/:open_id)
router.delete("/:open_id", (req, res) => {
  try {
    const { open_id } = req.params;
    const users = loadUsers();
    const filtered = users.filter(u => u.open_id !== open_id);
    if (filtered.length === users.length) return res.status(404).json({ error: "not_found" });
    saveUsers(filtered);
    return res.json({ ok: true });
  } catch (err) {
    console.error("profile delete error:", err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
});

export default router; - users.json: [] - and that´s it. either way ill give you all the files and you do this Go to your frontend code (App.jsx or NavBar or ProfileModal)

Search for ANY of these wrong URLs:

/profile
https://leaderbox.co/profile


They need to be replaced with the correct one:

/api/profile and return them back to me in full in the chat! -> // src/App.jsx
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
} - import React from "react";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { BrowserRouter } from "react-router-dom";
import '@fortawesome/fontawesome-free/css/all.min.css';


createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
    <App />
    </BrowserRouter>
  </React.StrictMode>,
); - {
  "rewrites": [
    {
      "source": "/privacy",
      "destination": "/privacy.html"
    },
    {
      "source": "/terms",
      "destination": "/terms.html"
    },
    {
      "source": "/auth/tiktok/callback",
      "destination": "/"
    }
  ]
} - import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
}) - // src/pages/Signup.jsx
import React from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) {
    return window.__ENV[varName];
  }
  if (typeof window !== "undefined" && typeof import.meta !== "undefined" && import.meta.env && import.meta.env[varName]) {
    return import.meta.env[varName];
  }
  return fallback;
}

export default function Signup() {
  const CLIENT_KEY = getRuntimeEnv("VITE_TIKTOK_CLIENT_KEY", "");
  const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI", "");
  const SCOPES = "user.info.basic";

  if (!CLIENT_KEY) console.error("❌ ERROR: VITE_TIKTOK_CLIENT_KEY not loaded.");
  if (!REDIRECT_URI) console.error("❌ ERROR: VITE_TIKTOK_REDIRECT_URI not loaded.");

  function generateState(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => ("0" + dec.toString(16)).slice(-2)).join("");
  }

  function base64urlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function generateCodeVerifier(length = 64) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    // use random bytes hex -> good entropy
    return Array.from(array, (b) => ("0" + b.toString(16)).slice(-2)).join("");
  }

  async function createCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    return base64urlEncode(digest);
  }

  async function startTikTokLogin() {
    if (!CLIENT_KEY || !REDIRECT_URI) {
      alert("TikTok configuration missing. Check console for details.");
      return;
    }

    const state = generateState(24);
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);

    // store for callback verification
    sessionStorage.setItem("tiktok_oauth_state", state);
    sessionStorage.setItem("tiktok_code_verifier", codeVerifier);

    console.log("PKCE state (stored):", state);
    console.log("PKCE code_verifier (stored):", codeVerifier);
    console.log("PKCE code_challenge (sent):", codeChallenge);
    console.log("Redirect URI (sent):", REDIRECT_URI);

    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      response_type: "code",
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    window.location.href = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Create an account</h2>
      <p>Click below to continue with TikTok</p>
      <button
        onClick={startTikTokLogin}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          background: "#010101",
          color: "white",
          fontWeight: 600,
        }}
      >
        Continue with TikTok
      </button>
    </div>
  );
} - import React, { useEffect, useState } from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) return window.__ENV[varName];
  if (typeof window !== "undefined" && import.meta.env && import.meta.env[varName]) return import.meta.env[varName];
  return fallback;
}

export default function TikTokCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const returnedState = params.get("state");
      const error = params.get("error");

      console.log("Callback URL params:", Object.fromEntries(params.entries()));

      if (error) {
        setStatus("error");
        setMessage(`Authorization error: ${error} ${params.get("error_description") || ""}`);
        return;
      }
      if (!code) {
        setStatus("error");
        setMessage("No authorization code received from TikTok.");
        return;
      }

      const storedState = sessionStorage.getItem("tiktok_oauth_state");
      const storedCodeVerifier = sessionStorage.getItem("tiktok_code_verifier");

      console.log("Stored state:", storedState);
      console.log("Returned state:", returnedState);
      console.log("Stored code_verifier:", storedCodeVerifier);

      if (!storedState || storedState !== returnedState || !storedCodeVerifier) {
        setStatus("error");
        setMessage("Invalid state or missing code_verifier. Cannot continue. (Check console logs)");
        return;
      }

      setStatus("exchanging");
      setMessage("Exchanging code with server...");

      try {
        const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI", window.location.origin + "/auth/tiktok/callback");

        const payload = { code, code_verifier: storedCodeVerifier, redirect_uri: REDIRECT_URI };
        console.log("Exchange payload (sent):", payload);

        const res = await fetch("/api/auth/tiktok/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        });

        // read raw text first for robust debugging
        const raw = await res.text();
        let data = null;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          // Not JSON — show server response for debugging
          console.error("Exchange returned non-JSON:", raw);
          setStatus("error");
          setMessage(`Exchange returned non-JSON: ${raw.slice(0, 1000)}`);
          return;
        }

        console.log("Exchange response (parsed):", data);
        if (!res.ok) {
          setStatus("error");
          setMessage(`Server exchange failed: ${res.status} ${JSON.stringify(data).slice(0, 500)}`);
          return;
        }

        // success path
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        const tokens = data.tokens || data?.tokens || data;
        if (tokens) {
          localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));
        }
        if (data.profile) {
          localStorage.setItem("tiktok_profile", JSON.stringify(data.profile));
        }

        // ======================
        // SAVE PROFILE TO SERVER
        // ======================
        // (added block — posts minimal profile info to /api/profile and overwrites local tiktok_profile with server response)
        if (tokens?.open_id) {
          try {
            const profileRes = await fetch("/api/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                open_id: tokens.open_id,
                nickname: tokens.display_name,
                avatar: tokens.avatar_url
              })
            });

            const profileData = await profileRes.json();
            // store the server-returned profile (if any) in localStorage for the UI
            localStorage.setItem("tiktok_profile", JSON.stringify(profileData));
          } catch (err) {
            console.error("Failed to save profile:", err);
            // keep existing local profile if server save fails
          }
        }

        setStatus("success");
        setMessage("Logged in successfully. Redirecting...");
        setTimeout(() => {
          window.location.href = data.redirectUrl || "/";
        }, 700);
      } catch (err) {
        console.error("Exchange exception:", err);
        setStatus("error");
        setMessage(err.message || "Unknown error during code exchange.");
      }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h2>TikTok Authentication</h2>
      <p>Status: {status}</p>
      <pre style={{ whiteSpace: "pre-wrap", color: status === "error" ? "#a00" : "#333" }}>{message}</pre>
      {status === "processing" && <p>Working… (check console for diagnostic logs)</p>}
      {status === "error" && <p>See console logs. Keep this page open to copy logs & retry after fixes.</p>}
    </div>
  );
} - import React, { useEffect, useState } from "react";

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
          // accept either pfp or avatar (server returns `avatar`, older code expected `pfp`)
          pfp:
            parsed.pfp ||
            parsed.avatar ||
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
          {user.pfp ? (
            <img src={user.pfp} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
            <button className="modal-btn">Edit display name</button>
            <button className="modal-btn" style={{ marginLeft: 8 }}>Change avatar</button>
          </div>
        </div>
      </div>
    </div>
  );
} - import React from "react";
import { v4 as uuidv4 } from "uuid";

function base64urlencode(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlencode(digest);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlencode(array);
}

export default function TikTokLoginButton() {
  const handleLogin = async () => {
    const codeVerifier = generateCodeVerifier();
    const state = uuidv4();

    sessionStorage.setItem("tiktok_code_verifier", codeVerifier);
    sessionStorage.setItem("tiktok_oauth_state", state);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const CLIENT_KEY = import.meta.env.VITE_TIKTOK_CLIENT_KEY;
    const REDIRECT_URI = import.meta.env.VITE_TIKTOK_REDIRECT_URI;

    const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&response_type=code&scope=user.info.basic&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    window.location.href = authUrl;
  };

  return <button onClick={handleLogin}>Login with TikTok</button>;
} - // src/components/NavBar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function NavBar({ user, onOpenProfile }) {
  const nav = useNavigate();
  const pfp = user?.pfp || user?.avatar || null;

  return (
    <div className="navbar">
      <div className="brand" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div className="logo" />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <div style={{ fontSize: 14, color: "var(--accent)" }}>LeaderBox</div>
          <div className="small">Your movie taste sucks</div>
        </div>
      </div>

      <div className="navLinks">
        <Link to="/">Home</Link>
        <Link to="/duel">Duel</Link>
        <Link to="/rules">Rules</Link>

        {/* Always show a Profile link/button so users can navigate to /profile */}
        <button
          className="btn"
          onClick={() => nav("/profile")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.04)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer"
          }}
        >
          {pfp ? (
            <img src={pfp} alt="pfp" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }} />
          ) : (
            <i className="fa fa-user" />
          )}
          Profile
        </button>

        {!user ? (
          <>
            <Link
              to="/signup"
              className="btn"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", padding: "8px 12px" }}
            >
              Sign up
            </Link>
            <Link to="/login" className="btn" style={{ background: "var(--accent)", color: "var(--black)", padding: "8px 12px" }}>
              Log in
            </Link>
          </>
        ) : (
          <>
            {/* Profile modal opener */}
            <button className="btn" onClick={() => onOpenProfile()}>
              Open
            </button>
          </>
        )}
      </div>
    </div>
  );
} - import React from "react";
import VideoSection from "./VideoSection";
import Support from "./Support";

export default function Landing(){
 return (
  <>
   <div style={{display:"grid",gap:14}}>
    <div className="card">
      <h1 className="h1-retro">Select your 4 favorite movies and build the perfect stack!</h1>
      <div className="subtitle">Choose your movies, craft your deck and duel against other cinephiles!
    </div>
   </div> 
   
   <VideoSection />

    <Support />
   </div>
  </>
 );
} - // src/components/ProfileModal.jsx
import React, { useEffect, useState } from "react";

const LEVELS = [
  { level: 1, name: "Noob", threshold: 0 },
  { level: 2, name: "Casual Viewer", threshold: 5 },
  { level: 3, name: "Youtuber Movie Critic", threshold: 11 },
  { level: 4, name: "Movie Festival Goer", threshold: 18 },
  { level: 5, name: "Indie Afficionado", threshold: 26 },
  { level: 6, name: "Cult Classics Schoolar", threshold: 35 },
  { level: 7, name: "Film Buff", threshold: 45 },
  { level: 8, name: "Film Curator", threshold: 56 },
  { level: 9, name: "Cinephile", threshold: 68 }
];

function getLevelByWins(wins) {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (wins >= LEVELS[i].threshold) {
      current = LEVELS[i];
      break;
    }
  }
  return current;
}

// helper localStorage helpers
const LOCAL_KEY = "stored_profile";
export function saveProfileToLocal(p) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  } catch (e) {
    console.warn("Failed saving profile:", e);
  }
}
export function loadProfileFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
export function clearLocalProfile() {
  try {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem("tiktok_tokens");
  } catch (e) {}
}

export default function ProfileModal({ open = false, onClose = () => {}, user = null, onLogout = () => {}, onUpdateUser = () => {} }) {
  const [isOpen, setOpen] = useState(open);
  useEffect(() => setOpen(open), [open]);

  useEffect(() => {}, []);

  async function doLogout() {
    // if you have an API logout, call it here; otherwise clear local storage
    clearLocalProfile();
    onLogout();
    onUpdateUser(null);
  }

  // If no user, show login/signup CTA inside modal
  if (!user) {
    const localProfile = loadProfileFromLocal();
    return (
      <>
        <div className="profile-knob" onClick={() => { setOpen(true); onClose && onClose(); }}>
          ?
        </div>

        <div className={`profile-modal ${isOpen ? "open" : ""}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "var(--accent)" }}>Profile</div>
            <div className="small">You must login to view profile</div>

            {/* If there's a stored local profile, allow loading it */}
            {localProfile ? (
              <>
                <div className="small">Found a saved profile. Use it to preview your account locally.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="modal-btn"
                    onClick={() => {
                      onUpdateUser(localProfile);
                      setOpen(false);
                    }}
                  >
                    Use saved profile
                  </button>
                  <button
                    className="modal-btn"
                    onClick={() => {
                      clearLocalProfile();
                      setOpen(false);
                    }}
                  >
                    Clear saved profile
                  </button>
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="modal-btn" onClick={() => (window.location.href = "/login")}>Log in</button>
              <button className="modal-btn" onClick={() => (window.location.href = "/signup")}>Sign up</button>
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <button className="modal-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      </>
    );
  }

  // have a user; ensure it's saved locally whenever modal opens
  useEffect(() => {
    if (user) saveProfileToLocal(user);
  }, [user]);

  const level = getLevelByWins(user.wins || 0);

  return (
    <>
      <div className="profile-knob" onClick={() => setOpen(!isOpen)}>{isOpen ? "<" : ">"}</div>
      <div className={`profile-modal ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="pfp" style={{ width: 64, height: 64, overflow: "hidden", borderRadius: 12 }}>
              {user.pfp ? <img src={user.pfp} alt="pfp" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{padding:12}}>{(user.nickname||"U").slice(0,1).toUpperCase()}</div>}
            </div>
            <div>
              <div style={{ fontWeight: 900, color: "var(--accent)" }}>{user.nickname}</div>
              <div className="small">{user.email || ""}</div>
            </div>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.04)" }} />

          <button className="modal-btn" onClick={() => (window.location.href = "/profile")}>Edit Stack</button>

          <div style={{ padding: "8px", borderRadius: 8, background: "rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="small">Wins</div>
              <div className="small">{user.wins || 0}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="small">Losses</div>
              <div className="small">{user.losses || 0}</div>
            </div>
          </div>

          <button
            className="modal-btn"
            onClick={() => {
              // Example: change pfp locally (for demo)
              const newUser = { ...user, nickname: user.nickname || "User" };
              saveProfileToLocal(newUser);
              onUpdateUser(newUser);
            }}
          >
            Change pfp
          </button>

          <button className="modal-btn">Change Password</button>
          <button className="modal-btn" onClick={() => { clearLocalProfile(); onUpdateUser(null); }}>Delete Profile</button>

          <hr style={{ borderColor: "rgba(255,255,255,0.04)" }} />

          <div>
            <div className="small" style={{ color: "var(--accent)" }}>Level {level.level} - {level.name}</div>
            <div className="level-bar" style={{ marginTop: 8 }}>
              {LEVELS.map(l => (
                <div key={l.level} className="level-pill" style={{ background: (l.level === level.level) ? "var(--accent)" : "transparent", color: (l.level === level.level) ? "var(--black)" : "var(--white)" }}>{l.level}</div>
              ))}
            </div>
          </div>
        </div>

        <button className="modal-btn" onClick={doLogout}>Logout</button>
      </div>
    </>
  );
} - import React from "react";

export default function Support(){
    return (
     <div>
        <div className="support card">
            <div className="left">
                <div className="small">Based on JangoDisc's video!
                <a className="small" href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:8}}>
                    <i className="fa fa-youtube"/> Youtube {/*I'll setup the fontawesome icon later*/}
                </a>
            </div>

            <div style={{flex:1}} />
            
            <div className="righ">
                <a className="small" href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginRight:8}}>
                    <i className="fa fa-youtube"/> Youtube
                </a>
                <div className="small">Website by Rick's a Human</div>
            </div>
         </div>
        </div>
     </div>
    );
}

{/*BOTH THE SUPPORT AND THE VIDEO SECTION FILES ARE PRETTY BASIC AT THE MOMENT CAUSE ILL FIRST FOCUS ON GETTING THE PROFILE SET UP AND MANAGEMENT SIDE OF THINGS READY*/} - import React from "react";
import { useNavigate } from "react-router-dom"

export default function VideoSection() {
 const nav = useNavigate();
 return (
    <div className="video-section card">
        <video src="/" controls muted loop playsInline />
        <button className="duel-button" onClick={()=>nav("/duel")}>DUEL NOW!</button>
    </div>
 );
} 
