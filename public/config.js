// runtime env for frontend
app.get("/config.js", (req, res) => {
  const js = `window.__ENV = ${JSON.stringify({
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "awjs5urmu24dmwqc",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || "https://leaderbox.co/auth/tiktok/callback",
    VITE_LETTERBOXD_CLIENT_KEY: process.env.VITE_LETTERBOXD_CLIENT_KEY || "oqKLT2bpwn0gpTTTAHs0pBGbu22J2mB8",
    VITE_LETTERBOXD_REDIRECT_URI: process.env.VITE_LETTERBOXD_REDIRECT_URI || "https://leaderbox.co/auth/letterboxd/callback",
    LEADERBOX_SERVER_BASE: process.env.LEADERBOX_SERVER_BASE || "https://leaderbox.co",
  })};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});
