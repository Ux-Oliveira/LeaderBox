// server/index.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import fs from "fs";
import cookieParser from "cookie-parser";
import profileRoutes from "./routes/profile.js";
import { exchangeTikTokCode } from "./tiktok.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(">>> STARTING leaderbox/server/index.js — PID", process.pid);
console.log(">>> index.js loaded from", __filename);
console.log(">>> cwd:", process.cwd());

const app = express();
const PORT = Number(process.env.PORT || 4000);

// middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// request logger
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// runtime env for frontend
app.get("/config.js", (req, res) => {
  const js = `window.__ENV = ${JSON.stringify({
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || "",
    LEADERBOX_SERVER_BASE: process.env.LEADERBOX_SERVER_BASE || "",
  })};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// health routes
app.get("/api/_health", (req, res) => res.json({ ok: true, msg: "server-up", time: Date.now() }));
app.get("/api/_whoami", (req, res) => res.json({ ok: true, cwd: process.cwd(), dirname: __dirname }));

// mount profile router with try/catch for visibility
try {
  app.use("/api/profile", profileRoutes);
  console.log(">>> mounted profileRoutes at /api/profile");
} catch (err) {
  console.error("Failed to mount profileRoutes:", err);
}

// PKCE exchange endpoint
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body;
    if (!code || !code_verifier) return res.status(400).json({ error: "Missing code or code_verifier" });

    const tokens = await exchangeTikTokCode({ code, code_verifier, redirect_uri });
    return res.json({ tokens, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange error:", err && (err.stack || err));
    return res.status(500).json({ error: "Exchange failed", details: String(err) });
  }
});

// serve frontend build if present
const buildPath = path.resolve(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("<h1>Leaderbox server running</h1><p>No frontend build found.</p>"));
}

// start server
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}  (PID ${process.pid})`);
  console.log(">>> Server ready, test: curl http://127.0.0.1:4000/api/profile");
});
