// server/index.js
import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import { randomUUID } from "node:crypto";
import fs from "fs";

import { getTikTokAuthURL, generatePKCEPair, exchangeTikTokCode } from "./tiktok.js";
import tiktokCallbackRouter from "./api/auth/tiktok/callback.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4000;

const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, FRONTEND_BUILD_PATH = "../client/build" } = process.env;

if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
  console.warn("Warning: Missing TikTok env vars. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI in .env");
}

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Serve runtime config to browser
app.get("/config.js", (req, res) => {
  const publicEnv = {
    VITE_TIKTOK_CLIENT_KEY: TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: TIKTOK_REDIRECT_URI || ""
  };
  const js = `window.__ENV = ${JSON.stringify(publicEnv, null, 2)};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// TikTok callback router
app.use("/auth/tiktok", tiktokCallbackRouter);

// TikTok login: generate PKCE, store code_verifier cookie
app.get("/auth/tiktok/login", (req, res) => {
  const state = randomUUID();
  const { code_verifier, code_challenge } = generatePKCEPair();

  // Store code_verifier keyed by state
  res.cookie(`tiktok_cv_${state}`, code_verifier, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });

  const url = getTikTokAuthURL({ state, code_challenge });
  res.redirect(url);
});

// Optional frontend PKCE -> server exchange
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ error: "Missing code or code_verifier" });

    const tokens = await exchangeTikTokCode({ code, code_verifier, redirect_uri: redirect_uri || TIKTOK_REDIRECT_URI });

    const sessionId = randomUUID();
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    return res.json({ ok: true, tokens, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
});

// Serve frontend
const buildCandidate = path.resolve(__dirname, FRONTEND_BUILD_PATH);
if (fs.existsSync(buildCandidate)) {
  app.use(express.static(buildCandidate));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildCandidate, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("<h1>Server running</h1><p>No frontend build found.</p>"));
}

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

