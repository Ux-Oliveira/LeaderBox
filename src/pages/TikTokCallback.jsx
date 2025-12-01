// src/pages/TikTokCallback.jsx
import React, { useEffect, useState } from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) return window.__ENV[varName];
  if (typeof window !== "undefined" && import.meta && import.meta.env && import.meta.env[varName]) return import.meta.env[varName];
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

      if (error) { setStatus("error"); setMessage(`Authorization error: ${error}`); return; }
      if (!code) { setStatus("error"); setMessage("No authorization code received from TikTok."); return; }

      const storedState = sessionStorage.getItem("tiktok_oauth_state");
      const storedCodeVerifier = sessionStorage.getItem("tiktok_code_verifier");

      console.log("Stored state:", storedState);
      console.log("Returned state:", returnedState);
      console.log("Stored code_verifier:", storedCodeVerifier);

      if (!storedState || storedState !== returnedState || !storedCodeVerifier) {
        setStatus("error");
        setMessage("Invalid state or missing code_verifier. Cannot continue.");
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
          credentials: "include"
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

        console.log("Exchange response (parsed):", data);

        if (!res.ok) {
          setStatus("error");
          setMessage(`Server exchange failed: ${res.status} — check console for response. (first 1000 chars shown)`);
          console.error("Exchange response (raw):", data);
          return;
        }

        // Clean PKCE artifacts
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        // Save tokens/profile (structure depends on server)
        const tokens = data.tokens || data.token || data.tokens || data;
        if (tokens) localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));
        if (data.profile) localStorage.setItem("tiktok_profile", JSON.stringify(data.profile));

        setStatus("success");
        setMessage("Logged in successfully. Redirecting to /");
        window.location.href = data.redirectUrl || "/";
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
    </div>
  );
}
