// src/pages/Login.jsx
import React from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) {
    return window.__ENV[varName];
  }
  return fallback;
}

export default function Login() {
  const CLIENT_KEY = getRuntimeEnv("VITE_TIKTOK_CLIENT_KEY");
  const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI");
  const SCOPES = "user.info.basic";

  function generateState(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ("0" + dec.toString(16)).substr(-2)).join("");
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

  async function startLogin() {
    if (!CLIENT_KEY || !REDIRECT_URI) {
      alert("TikTok config missing. Check console/env.");
      return;
    }

    const state = generateState(24);
    sessionStorage.setItem("tiktok_oauth_state", state);

    const codeVerifier = generateCodeVerifier(64);
    sessionStorage.setItem("tiktok_code_verifier", codeVerifier);

    const codeChallenge = await createCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      response_type: "code",
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    window.location.href = `https://www.tiktok.com/v2/oauth/authorize?${params.toString()}`;
  }

  return (
    <button onClick={startLogin} style={{ padding: "10px 16px", borderRadius: 6, background: "#010101", color: "#fff", cursor: "pointer" }}>
      Login with TikTok
    </button>
  );
}
