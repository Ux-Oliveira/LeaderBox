// api/profile/complete.js
// Wrapper so /api/profile/complete always invokes api/profile/index.js
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

export default async function handler(req, res) {
  try {
    if (!fs.existsSync(indexPath)) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "missing_handler", message: "api/profile/index.js not found" }));
      return;
    }

    // Make req.url look like '/complete' (keep query if present)
    try {
      req.originalUrlForWrapper = req.url;
      if (typeof req.url === "string") {
        const parts = req.url.split("?");
        const raw = parts[0] || "";
        const q = parts[1] ? "?" + parts[1] : "";
        if (!raw.endsWith("/complete")) {
          // if path already e.g. '/api/profile/complete' -> shorten to '/complete'
          if (raw.includes("/complete")) req.url = "/complete" + q;
          else req.url = "/complete" + q;
        } else {
          req.url = "/complete" + q;
        }
      }
    } catch (e) {
      // ignore
    }

    const mod = await import(indexPath);
    const fn = mod && (mod.default || mod.handler);
    if (typeof fn !== "function") {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "invalid_handler", message: "api/profile/index.js does not export default function" }));
      return;
    }
    return await fn(req, res);
  } catch (err) {
    console.error("wrapper /api/profile/complete error:", err && (err.stack || err));
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "internal_error", message: String(err && err.message ? err.message : err) }));
  }
}
