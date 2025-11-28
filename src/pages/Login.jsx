import React from "react";

/**
 * Login page using TikTok Login Kit.
 * Safe runtime env access via window.__ENV or process.env (if defined).
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

export default function Login({ onLogin }) {
  const CLIENT_KEY = getRuntimeEnv("REACT_APP_TIKTOK_CLIENT_KEY", "<YOUR_TIKTOK_CLIENT_KEY>");
  const REDIRECT_URI = getRuntimeEnv("REACT_APP_TIKTOK_REDIRECT_URI", "http://localhost:4000/api/auth/tiktok/callback");
  const SCOPES = "user.info.basic";

  function generateState(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ("0" + dec.toString(16)).substr(-2)).join("");
  }

  // helper: base64url encode an ArrayBuffer
  function base64urlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // generate a random code_verifier
  function generateCodeVerifier(length = 64) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (b) => ("0" + b.toString(16)).slice(-2)).join("");
  }

  // create code_challenge from code_verifier using SHA-256 -> base64url
  async function createCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return base64urlEncode(digest);
  }

  async function startTikTokLogin() {
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
      state: state,
      // PKCE fields:
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    window.location.href = url;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Login with TikTok</h2>
      <p>Click the button below and create an account with your TikTok.</p>

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
    </div>
  );
}
