// api/config.js
// Returns a small JS snippet that sets window.__ENV at runtime.
// Vercel will call this serverless function on each request, which lets us
// inject environment variables that are set in Vercel dashboard.

module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  // Only expose non-secret PUBLIC values to the browser.
  // Do NOT send client secret here.
  const publicEnv = {
    REACT_APP_TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY || "",
    REACT_APP_TIKTOK_REDIRECT_URI: process.env.TIKTOK_REDIRECT_URI || ""
  };

  const js = `// injected at runtime by serverless function.
window.__ENV = ${JSON.stringify(publicEnv, null, 2)};
if (typeof window.process === "undefined") {
  window.process = { env: ${JSON.stringify(publicEnv, null, 2)} };
} else {
  window.process.env = Object.assign({}, window.process.env || {}, ${JSON.stringify(publicEnv, null, 2)});
}
`;
  res.status(200).send(js);
};
