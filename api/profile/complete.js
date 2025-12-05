// api/profile/complete.js
// Small wrapper that ensures requests to /api/profile/complete
// are handled by the existing api/profile/index.js handler.
//
// This is helpful on Vercel where the router sometimes expects a
// file that exactly matches the nested path.

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

// If index.js exists, import it dynamically and call its default export handler.
// Otherwise return 500.
export default async function handler(req, res) {
  try {
    if (!fs.existsSync(indexPath)) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "missing_handler", message: "api/profile/index.js not found" }));
      return;
    }

    // dynamic import so we reuse the same file without duplication
    const mod = await import(indexPath);
    const fn = mod && (mod.default || mod.handler);
    if (typeof fn !== "function") {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "invalid_handler", message: "api/profile/index.js does not export default function" }));
      return;
    }

    // when Vercel invokes this file the req.url may be '/complete' or '/api/...' — normalize so the inner handler sees '/complete'
    // We set req.url to '/complete' when the path ends with '/complete' so the index.js logic that checks pathname works.
    try {
      // keep original for debugging
      req.originalUrlForWrapper = req.url;
      // normalize to /complete
      if (typeof req.url === "string") {
        const raw = req.url.split("?")[0] || "";
        if (raw.endsWith("/complete")) req.url = "/complete" + (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
      }
    } catch (e) {
      // ignore normalization failure
    }

    // call the handler (works for both express-like and plain function handlers)
    return await fn(req, res);
  } catch (err) {
    console.error("wrapper /api/profile/complete error:", err && (err.stack || err));
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "internal_error", message: String(err && err.message ? err.message : err) }));
  }
}
