// server/config.js
import express from "express";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();

router.get("/config.js", (req, res) => {
  const publicEnv = {
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || ""
  };
  res.setHeader("Content-Type", "application/javascript");
  res.send(`window.__ENV = ${JSON.stringify(publicEnv)};`);
});

export default router;
