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

        const raw = await res.text();
        let data = null;
        try {
          data = JSON.parse(raw);
        } catch (e) {
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

        // success — clear PKCE storage
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        // tokens may be in data.tokens or data.tokens.access_token
        const tokens = data.tokens || data?.tokens || data;
        if (tokens) {
          localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));
        }

        // server may return profile in data.profile
        let serverProfile = data.profile || null;
        if (serverProfile && serverProfile.profile) serverProfile = serverProfile.profile; // defensive

        // derive open_id from possible places
        const open_id =
          (serverProfile && (serverProfile.open_id || serverProfile.data?.open_id || serverProfile.raw?.data?.open_id)) ||
          tokens?.open_id ||
          tokens?.data?.open_id ||
          (data.profile && data.profile.open_id) ||
          null;

        // Normalize server profile fields if present
        const normalizedFromServer = serverProfile
          ? {
              open_id: serverProfile.open_id || serverProfile.data?.open_id || serverProfile.raw?.data?.open_id || null,
              nickname: serverProfile.nickname || serverProfile.display_name || serverProfile.raw?.data?.user?.display_name || null,
              avatar: serverProfile.avatar || serverProfile.raw?.data?.user?.avatar || serverProfile.raw?.avatar || null,
              raw: serverProfile.raw || serverProfile,
            }
          : null;

        // If server returned a profile with nickname+avatar, persist and continue to home
        if (normalizedFromServer && normalizedFromServer.nickname && normalizedFromServer.avatar) {
          localStorage.setItem("tiktok_profile", JSON.stringify(normalizedFromServer));
          setStatus("success");
          setMessage("Logged in. Redirecting…");
          setTimeout(() => window.location.href = data.redirectUrl || "/", 700);
          return;
        }

        // IMPORTANT: If TikTok token response didn't include profile/nickname/avatar,
        // query our server's /api/profile with the open_id — maybe we already have a profile saved.
        if (open_id) {
          try {
            console.log("Checking server for existing profile open_id=", open_id);
            const pRes = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`, { credentials: "same-origin" });
            if (pRes.ok) {
              const pText = await pRes.text();
              let pJson = null;
              try { pJson = JSON.parse(pText); } catch (e) { pJson = null; }
              const serverStored = pJson && (pJson.profile || (pJson.profiles ? pJson.profiles.find(() => true) : null));
              // pJson.profile is expected for single-query
              const profileObj = pJson && pJson.profile ? pJson.profile : null;
              if (profileObj) {
                // If server profile has nickname and avatar -> use it and skip choose-profile
                if (profileObj.nickname && profileObj.avatar) {
                  const safe = {
                    open_id: profileObj.open_id,
                    nickname: profileObj.nickname.replace(/^@/, ""),
                    avatar: profileObj.avatar,
                    wins: profileObj.wins || 0,
                    losses: profileObj.losses || 0,
                    level: profileObj.level || 1,
                    raw: profileObj,
                  };
                  localStorage.setItem("tiktok_profile", JSON.stringify(safe));
                  setStatus("success");
                  setMessage("Logged in (existing account). Redirecting…");
                  setTimeout(() => window.location.href = data.redirectUrl || "/", 700);
                  return;
                }
              }
            } else {
              console.log("/api/profile responded not-ok when checking existing profile");
            }
          } catch (errCheck) {
            console.warn("Error checking server profile:", errCheck);
            // fallthrough to choose-profile
          }
        }

        // If we reach here — we do not have nickname/avatar from server or TikTok.
        // Save a minimal profile to localStorage for choose-profile page to use.
        console.log("Redirecting user to choose-profile to complete account (nickname/avatar missing)");
        const minimal = {
          open_id,
          nickname: normalizedFromServer?.nickname || null,
          avatar: normalizedFromServer?.avatar || null,
          raw: normalizedFromServer?.raw || data.profile || data.tokens || data,
        };
        localStorage.setItem("tiktok_profile", JSON.stringify(minimal));
        window.location.href = "/choose-profile";
        return;
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
}
