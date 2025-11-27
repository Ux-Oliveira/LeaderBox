// src/pages/Signup.jsx
import React from "react";

/**
 * Signup page using TikTok Login Kit (OAuth v2).
 * Safe runtime env access: checks window.__ENV first, then process.env only if defined.
 */

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) {
    return window.__ENV[varName];
  }
  if (typeof process !== "undefined" && process && process.env && process.env[varName]) {
    return process.env[varName];
  }
  return fallback;
}

export default function Signup({ onSigned }) {
  const CLIENT_KEY = getRuntimeEnv("REACT_APP_TIKTOK_CLIENT_KEY", "<YOUR_TIKTOK_CLIENT_KEY>");
  const REDIRECT_URI = getRuntimeEnv("REACT_APP_TIKTOK_REDIRECT_URI", "http://localhost:4000/api/auth/tiktok/callback");
  const SCOPES = "user.info.basic";

  function generateState(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ("0" + dec.toString(16)).substr(-2)).join("");
  }

  function startTikTokLogin() {
    const state = generateState(24);
    sessionStorage.setItem("tiktok_oauth_state", state);

    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      response_type: "code",
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state: state
    });

    const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    window.location.href = url;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Create an account.</h2>
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
          fontWeight: 600
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden>
          <path d="M32 10v14a8 8 0 1 1-8-8V10c4 0 6 0 8 2z" fill="currentColor" />
        </svg>
        Continue with TikTok
      </button>

      <p style={{ marginTop: 12, color: "#666" }}>
        After authorizing, you'll be returned to the app. If you already have an account, welcome back!
      </p>
    </div>
  );
}
