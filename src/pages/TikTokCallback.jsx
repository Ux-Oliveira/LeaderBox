import React, { useEffect, useState } from "react";

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

      if (error) { setStatus("error"); setMessage(`Authorization error: ${error} ${params.get("error_description") || ""}`); return; }
      if (!code) { setStatus("error"); setMessage("No authorization code received from TikTok."); return; }

      const storedState = sessionStorage.getItem("tiktok_oauth_state");
      const storedCodeVerifier = sessionStorage.getItem("tiktok_code_verifier");

      if (!storedState || storedState !== returnedState || !storedCodeVerifier) {
        setStatus("error");
        setMessage("Invalid state or missing code_verifier. Check console logs.");
        console.error("Stored state:", storedState, "returnedState:", returnedState, "code_verifier:", storedCodeVerifier);
        return;
      }

      setStatus("exchanging");
      setMessage("Exchanging code with server...");

      try {
        const REDIRECT_URI = getRuntimeEnv("VITE_TIKTOK_REDIRECT_URI", window.location.origin + "/auth/tiktok/callback");
        const payload = { code, code_verifier: storedCodeVerifier, redirect_uri: REDIRECT_URI };
        const res = await fetch("/api/auth/tiktok/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const raw = await res.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : {}; } catch (e) {
          setStatus("error");
          setMessage(`Exchange returned non-JSON: ${raw.slice(0,1000)}`);
          console.error("Exchange raw:", raw);
          return;
        }

        if (!res.ok) {
          setStatus("error");
          setMessage(`Server exchange failed: ${res.status} ${JSON.stringify(data).slice(0,500)}`);
          console.error("Exchange error:", data);
          return;
        }

        // success: normalize profile
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        const tokens = data.tokens || data;
        if (tokens) localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));

        let serverProfileCandidate = null;
        const p = data.profile || data.profile || null;

        // robust normalization:
        if (p) {
          serverProfileCandidate = {
            open_id: p.open_id || p.raw?.data?.user?.open_id || p.raw?.open_id || (tokens && (tokens.open_id || tokens.data?.open_id)) || null,
            nickname: p.display_name || p.nickname || (p.raw && (p.raw.data?.user?.display_name || p.raw.display_name)) || (tokens && (tokens.display_name || tokens.nickname)) || null,
            avatar: p.avatar || p.raw?.data?.user?.avatar || p.raw?.avatar || (tokens && (tokens.avatar_url || tokens.avatar)) || null,
            raw: p.raw || p,
          };
        } else {
          // fallback: tokens may contain open_id
          const open_id = tokens?.open_id || tokens?.data?.open_id || null;
          if (open_id) {
            serverProfileCandidate = {
              open_id,
              nickname: tokens?.display_name || tokens?.nickname || `@${open_id}`,
              avatar: tokens?.avatar_url || tokens?.avatar || null,
              raw: tokens,
            };
          }
        }

        if (serverProfileCandidate) {
          localStorage.setItem("tiktok_profile", JSON.stringify(serverProfileCandidate));
        }

        setStatus("success");
        setMessage("Logged in successfully. Redirecting...");
        setTimeout(() => window.location.href = data.redirectUrl || "/", 700);
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
      {status === "processing" && <p>Working… (check console)</p>}
      {status === "error" && <p>See console logs for diagnostics.</p>}
    </div>
  );
}
