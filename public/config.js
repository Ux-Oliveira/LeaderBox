// server/index.js
app.get("/config.js", (req, res) => {
  const envVars = {
    VITE_TIKTOK_CLIENT_KEY: process.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: process.env.VITE_TIKTOK_REDIRECT_URI || ""
  };
  const js = `window.__ENV = ${JSON.stringify(envVars)};`;
  res.setHeader("Content-Type", "application/javascript");
  res.send(js);
});
