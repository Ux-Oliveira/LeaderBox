// api/profile/[open_id].js
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

async function readAndAttachBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return;
  if (req.rawBody) {
    req.body = typeof req.rawBody === "string" ? tryJson(req.rawBody) : tryJsonBuffer(req.rawBody);
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  req.rawBody = buf;
  if (!buf || buf.length === 0) return;
  req.body = tryJsonBuffer(buf);
}
function tryJson(str) {
  try { return JSON.parse(str); } catch (e) { try { return JSON.parse(String(str).trim()); } catch (e2) { throw new Error("Invalid JSON"); } }
}
function tryJsonBuffer(buf) {
  try { return JSON.parse(buf.toString("utf8")); } catch (e) { try { return JSON.parse(buf.toString("utf8").trim()); } catch (e2) { throw new Error("Invalid JSON"); } }
}

export default async function handler(req, res) {
  try {
    if (!fs.existsSync(indexPath)) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "missing_handler", message: "api/profile/index.js not found" }));
      return;
    }

    // normalize to '/<open_id>' path (index.js handles pathname variants)
    try {
      req.originalUrlForWrapper = req.url;
      if (typeof req.url === "string") {
        const parts = req.url.split("?");
        const raw = parts[0] || "";
        const q = parts[1] ? "?" + parts[1] : "";
        const seg = raw.split("/").filter(Boolean).slice(-1)[0] || "";
        req.url = "/" + seg + q;
      }
    } catch (e) { /* ignore */ }

    try { await readAndAttachBody(req); } catch (e) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "invalid_json", message: String(e.message || e) }));
      return;
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
    console.error("wrapper /api/profile/[open_id] error:", err && (err.stack || err));
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "internal_error", message: String(err && err.message ? err.message : err) }));
  }
}
