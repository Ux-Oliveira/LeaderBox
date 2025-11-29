// src/pages/Signup.jsx
import React from "react";

// Safe runtime environment helper
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

  function generateState(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ("0" + dec.toString(16)).slice(-2)).join("");
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
    return Array.from(array, b => ("0" + b.toString(16)).slice(-2)).join("");
  }

  async function createCodeChallenge(codeVerifier) {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    return base64urlEncode(digest);
  }

  async function startTikTokLogin() {
    if (!CLIENT_KEY || !REDIRECT_URI) {
      alert("TikTok configuration missing. Check console.");
      return;
    }

    const state = generateState(24);
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);

    sessionStorage.setItem("tiktok_oauth_state", state);
    sessionStorage.setItem("tiktok_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      response_type: "code",
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    // ✅ Correct TikTok endpoint (auth)
    window.location.href = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Create an account</h2>
      <p>Click below to continue with TikTok</p>
      <button onClick={startTikTokLogin} style={{
        display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 16px",
        borderRadius: 8, border: "none", cursor: "pointer", background: "#010101", color: "white", fontWeight: 600
      }}>
        Continue with TikTok
      </button>
    </div>
  );
}
