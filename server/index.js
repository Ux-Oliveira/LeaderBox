import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import fs from "fs";
import { exchangeTikTokCode } from "./tiktok.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4000;

app.use(bodyParser.json());

// Serve runtime env to frontend
app.get("/config.js", (req, res) => {
  const js = `window.__ENV = ${JSON.stringify({
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || "",
  })};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});

// Frontend PKCE -> server exchange
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body;
    if (!code || !code_verifier) return res.status(400).json({ error: "Missing code or code_verifier" });

    const tokens = await exchangeTikTokCode({ code, code_verifier, redirect_uri });
    return res.json({ tokens, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Exchange failed", details: String(err) });
  }
});

// Serve frontend
const buildPath = path.resolve(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/config.js") return next();
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("<h1>Server running</h1><p>No frontend build found.</p>"));
}

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
