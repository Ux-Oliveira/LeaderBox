// src/pages/TikTokCallback.jsx
import React, { useEffect, useState } from "react";
import { saveProfileToLocal } from "../lib/profileLocal";

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

        // success — clear PKCE storage
        sessionStorage.removeItem("tiktok_oauth_state");
        sessionStorage.removeItem("tiktok_code_verifier");

        // tokens may be in data.tokens or data.tokens.access_token
        const tokens = data.tokens || data?.tokens || data;
        if (tokens) {
          localStorage.setItem("tiktok_tokens", JSON.stringify(tokens));
        }

        // server may return profile in data.profile (could be nested)
        let serverProfile = data.profile || null;
        if (serverProfile && serverProfile.profile) serverProfile = serverProfile.profile;

        // Normalize server profile for client storage (store nickname without @)
        const normalizedFromServer = serverProfile
          ? {
              open_id: serverProfile.open_id || serverProfile.data?.open_id || serverProfile.raw?.data?.open_id || null,
              nickname: serverProfile.nickname ? String(serverProfile.nickname).replace(/^@/, "") : null,
              avatar: serverProfile.avatar || serverProfile.raw?.data?.user?.avatar || serverProfile.raw?.avatar || null,
              raw: serverProfile.raw || serverProfile,
            }
          : null;

        // If server returned a profile, prefer that and persist locally
        if (normalizedFromServer && normalizedFromServer.open_id) {
          saveProfileToLocal(normalizedFromServer);
        }

        // If we don't yet have nickname or avatar we must route to choose-profile
        const clientProfileRaw = localStorage.getItem("tiktok_profile");
        const clientProfile = clientProfileRaw ? JSON.parse(clientProfileRaw) : null;

        const hasNickname = (clientProfile && clientProfile.nickname) || (normalizedFromServer && normalizedFromServer.nickname);
        const hasAvatar = (clientProfile && (clientProfile.avatar)) || (normalizedFromServer && normalizedFromServer.avatar);

        if (!hasNickname || !hasAvatar) {
          console.log("Redirecting user to choose-profile to complete account (nickname/avatar missing)");
          // Save minimal open_id and raw tokens so the choose-profile page can complete
          const open_id = normalizedFromServer?.open_id || tokens?.open_id || tokens?.data?.open_id || (data.profile && data.profile.open_id) || null;
          const minimal = {
            open_id,
            nickname: normalizedFromServer?.nickname || null,
            avatar: normalizedFromServer?.avatar || null,
            raw: normalizedFromServer?.raw || data.profile || data.tokens || data,
          };
          localStorage.setItem("tiktok_profile", JSON.stringify(minimal));
          window.location.href = "/choose-profile";
          return;
        }

        // If we have an open_id, fetch authoritative profile from server to ensure local is in sync
        const open_id = normalizedFromServer?.open_id || tokens?.open_id || (data.profile && data.profile.open_id) || null;
        if (open_id) {
          try {
            const pRes = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`, { credentials: "same-origin" });
            const pText = await pRes.text();
            let pJson = null;
            try { pJson = JSON.parse(pText); } catch (e) { pJson = null; }
            if (pRes.ok && pJson && pJson.profile) {
              const serverProfile = pJson.profile;
              const safe = {
                open_id: serverProfile.open_id,
                nickname: serverProfile.nickname ? String(serverProfile.nickname).replace(/^@/, "") : null,
                avatar: serverProfile.avatar || null,
                wins: serverProfile.wins || 0,
                losses: serverProfile.losses || 0,
                level: serverProfile.level || 1,
                deck: Array.isArray(serverProfile.deck) ? serverProfile.deck : [],
              };
              saveProfileToLocal(safe);
            }
          } catch (e) {
            console.warn("Failed fetching profile after exchange:", e);
          }
        }

        // otherwise continue to home (or redirectUrl if provided)
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
}
