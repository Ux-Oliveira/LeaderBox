// src/runtimeConfig.js
// Lightweight runtime config shim — reads Vite envs at build time and exposes
// window.__CONFIG__ for runtime use (works in dev and after build).
(function () {
  const cfg = {
    VITE_TIKTOK_CLIENT_KEY: import.meta.env.VITE_TIKTOK_CLIENT_KEY || "",
    VITE_TIKTOK_REDIRECT_URI: import.meta.env.VITE_TIKTOK_REDIRECT_URI || ""
  };

  // expose a single object
  if (typeof window !== "undefined") {
    window.__CONFIG__ = Object.assign({}, window.__CONFIG__ || {}, cfg);
  }
})();
