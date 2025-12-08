import React, { useEffect, useState } from "react";

function getRuntimeEnv(varName, fallback = "") {
  if (typeof window !== "undefined" && window.__ENV && window.__ENV[varName]) return window.__ENV[varName];
  if (typeof window !== "undefined" && import.meta.env && import.meta.env[varName]) return import.meta.env[varName];
  return fallback;
}

export default function LetterboxdCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const returnedState = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Authorization error: ${error} ${params.get("error_description") || ""}`);
        return;
      }
      if (!code) {
        setStatus("error");
        setMessage("No authorization code received from Letterboxd/Auth0.");
        return;
      }

      const storedState = sessionStorage.getItem("lbx_oauth_state");
      const storedCodeVerifier = sessionStorage.getItem("lbx_code_verifier");
      if (!storedState || storedState !== returnedState || !storedCodeVerifier) {
        setStatus("error");
        setMessage("Invalid state or missing code_verifier. Cannot continue. (Check console logs)");
        return;
      }

      setStatus("exchanging");
      setMessage("Exchanging code with server...");

      try {
        const payload = { code, code_verifier: storedCodeVerifier };
        const res = await fetch("/api/auth/letterboxd/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        });

        const raw = await res.text();
        let data = null;
        try { data = JSON.parse(raw); } catch (e) {
          setStatus("error");
          setMessage(`Exchange returned non-JSON: ${raw.slice(0, 1000)}`);
          return;
        }

        if (!res.ok) {
          setStatus("error");
          setMessage(`Server exchange failed: ${res.status} ${JSON.stringify(data).slice(0, 500)}`);
          return;
        }

        // clear PKCE storage
        sessionStorage.removeItem("lbx_oauth_state");
        sessionStorage.removeItem("lbx_code_verifier");

        // server should return { tokens, profile }
        const tokens = data.tokens || null;
        const profile = data.profile || null;

        if (tokens) localStorage.setItem("lbx_tokens", JSON.stringify(tokens));
        if (profile && profile.open_id) {
          // normalize & persist like TikTok flow
          const safe = {
            open_id: profile.open_id,
            nickname: profile.nickname ? String(profile.nickname).replace(/^@/, "") : null,
            avatar: profile.avatar || null,
            raw: profile,
          };
          localStorage.setItem("tiktok_profile", JSON.stringify(safe)); // reuse keys your app expects
          setStatus("success");
          setMessage("Logged in (Letterboxd). Redirecting…");
          setTimeout(() => window.location.href = "/", 700);
          return;
        }

        // If profile missing, save minimal info and direct to choose-profile
        const minimal = {
          open_id: (data.tokens && data.tokens?.sub) || null,
          nickname: data.profile?.nickname || null,
          avatar: data.profile?.avatar || null,
          raw: data,
        };
        localStorage.setItem("tiktok_profile", JSON.stringify(minimal));
        window.location.href = "/choose-profile";
      } catch (err) {
        console.error("Letterboxd exchange exception:", err);
        setStatus("error");
        setMessage(err.message || "Unknown error during code exchange.");
      }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h2>Letterboxd Authentication</h2>
      <p>Status: {status}</p>
      <pre style={{ whiteSpace: "pre-wrap", color: status === "error" ? "#a00" : "#333" }}>{message}</pre>
      {status === "processing" && <p>Working… (check console for diagnostic logs)</p>}
      {status === "error" && <p>See console logs. Keep this page open to copy logs & retry after fixes.</p>}
    </div>
  );
}
