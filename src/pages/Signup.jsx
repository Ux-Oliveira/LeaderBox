// src/pages/Signup.jsx
import React from "react";

export default function Signup() {
  // Use window.__ENV provided by /config.js at runtime
  const CLIENT_KEY = window.__ENV?.VITE_TIKTOK_CLIENT_KEY || "";
  const REDIRECT_URI = window.__ENV?.VITE_TIKTOK_REDIRECT_URI || "";
  const SCOPES = "user.info.basic";

  if (!CLIENT_KEY) console.error("❌ ERROR: VITE_TIKTOK_CLIENT_KEY not loaded.");
  if (!REDIRECT_URI) console.error("❌ ERROR: VITE_TIKTOK_REDIRECT_URI not loaded.");

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
    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    return base64urlEncode(digest);
  }

  async function startTikTokLogin() {
    if (!CLIENT_KEY || !REDIRECT_URI) {
      alert("TikTok configuration missing. Check console.");
      return;
    }

    // Generate PKCE state & verifier
    const state = generateState(24);
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);

    // Store for callback verification
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
      code_challenge_method: "S256"
    });

    // Redirect to TikTok login
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
          fontWeight: 600
        }}
      >
        Continue with TikTok
      </button>
    </div>
  );
}
