// server/index.js
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "node:path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import { randomUUID } from "node:crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Read env values
const {
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token",
  FRONTEND_BUILD_PATH = "../client/build"
} = process.env;

// Basic checks
if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
  console.warn("Warning: Missing TikTok env vars. Please set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI in .env");
}

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// ---------------------------
// Serve runtime config to browser
// ---------------------------
// This returns a small JS that defines `window.__ENV` (and also `process.env`
// to avoid the "process is not defined" error in some frontends).
app.get("/config.js", (req, res) => {
  // Only expose PUBLIC values to the browser. Do NOT expose client secret here.
  const publicEnv = {
    REACT_APP_TIKTOK_CLIENT_KEY: TIKTOK_CLIENT_KEY || "",
    REACT_APP_TIKTOK_REDIRECT_URI: TIKTOK_REDIRECT_URI || ""
  };

  const js = `
    // injected at runtime by server. Safe to read from client.
    window.__ENV = ${JSON.stringify(publicEnv, null, 2)};
    // some bundlers expect process.env to exist - create a tiny shim
    if (typeof window.process === "undefined") {
      window.process = { env: ${JSON.stringify(publicEnv, null, 2)} };
    } else {
      window.process.env = Object.assign({}, window.process.env || {}, ${JSON.stringify(publicEnv, null, 2)});
    }
  `;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// ---------------------------
// Exchange endpoint
// ---------------------------
// This receives { code, code_verifier, redirect_uri? } from the frontend and exchanges it server-side with TikTok
// The server must use the client_secret. We do NOT leak client_secret to browser.
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: "Missing code in request body" });
    }

    // Use provided redirect_uri from frontend if present, otherwise fall back to env value
    const effectiveRedirectUri = redirect_uri || TIKTOK_REDIRECT_URI;
    if (!effectiveRedirectUri) {
      return res.status(400).json({ error: "Missing redirect_uri (server-side fallback not configured)" });
    }

    // Build token exchange payload as application/x-www-form-urlencoded (common for OAuth token endpoints)
    const params = new URLSearchParams();
    params.append("client_key", TIKTOK_CLIENT_KEY);
    params.append("client_secret", TIKTOK_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", effectiveRedirectUri);

    // Include code_verifier for PKCE if provided
    if (code_verifier) {
      params.append("code_verifier", code_verifier);
    } else {
      // warn but continue — some TikTok apps may not require PKCE server-side (but modern flows do)
      console.warn("No code_verifier provided by frontend. If your TikTok app requires PKCE, exchanges will fail.");
    }

    const tokenUrl = TIKTOK_TOKEN_URL;

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const tokenText = await tokenRes.text();
    let tokenJson;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (e) {
      // not JSON
      tokenJson = { raw: tokenText };
    }

    if (!tokenRes.ok) {
      console.error("TikTok token exchange failed", tokenRes.status, tokenText);
      return res.status(502).json({
        error: "TikTok token exchange failed",
        status: tokenRes.status,
        body: tokenJson
      });
    }

    // tokenJson should contain access token, refresh token, open_id, etc.
    // TODO: validate and look up/create user in DB based on open_id.
    // For demo we set a simple session cookie and return success.
    const sessionId = randomUUID();

    // You should store sessionId -> user data in DB. Here we just set cookie.
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    // Send client whatever minimal data needed. A typical server would create a user,
    // save tokens, and return a redirect URL or a JWT.
    return res.json({
      ok: true,
      tokens: tokenJson,
      redirectUrl: "/" // change to where you want users redirected after login
    });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
});

// ---------------------------
// Serve frontend static files (if available)
// ---------------------------
import fs from "fs";
const buildCandidate = path.resolve(__dirname, FRONTEND_BUILD_PATH);
if (fs.existsSync(buildCandidate)) {
  console.log("Serving static frontend from:", buildCandidate);
  app.use(express.static(buildCandidate));

  // SPA fallback
  app.get("*", (req, res, next) => {
    // avoid catching API routes
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildCandidate, "index.html"));
  });
} else {
  console.warn("Frontend build folder not found at", buildCandidate, "— server will still serve /config.js and API endpoints.");
  app.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<html><head><script src="/config.js"></script></head><body>
      <h1>Server running</h1>
      <p>No frontend build found at ${buildCandidate} — build your frontend and place it there (or set FRONTEND_BUILD_PATH).</p>
    </body></html>`);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
