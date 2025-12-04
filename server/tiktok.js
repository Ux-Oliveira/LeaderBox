// server/tiktok.js
import dotenv from "dotenv";
dotenv.config();

// Use global fetch (Node 18+). If not present, try node-fetch fallback.
let _fetch = global.fetch;
try {
  if (!_fetch) {
    const nodeFetch = await import("node-fetch");
    _fetch = nodeFetch.default;
  }
} catch (e) {
  // keep undefined if import fails; we'll throw later if needed
  _fetch = global.fetch;
}

const {
  // support multiple env var names for flexibility
  VITE_TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_KEY,
  VITE_TIKTOK_REDIRECT_URI,
  TIKTOK_CLIENT_SECRET,
  VITE_TIKTOK_CLIENT_SECRET,
  TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token",
  TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/",
} = process.env;

/**
 * Exchange PKCE code for tokens.
 * Returns the parsed JSON from TikTok (tokens + possibly open_id).
 */
export async function exchangeTikTokCode({ code, code_verifier, redirect_uri }) {
  if (!code || !code_verifier) throw new Error("Missing code or code_verifier");

  const clientKey = VITE_TIKTOK_CLIENT_KEY || TIKTOK_CLIENT_KEY;
  const clientSecret = VITE_TIKTOK_CLIENT_SECRET || TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    const msg = "TikTok client credentials not configured (VITE_TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET)";
    const err = new Error(msg);
    err.code = "CONFIG_MISSING";
    throw err;
  }

  const params = new URLSearchParams();
  params.append("client_key", clientKey);
  params.append("client_secret", clientSecret);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  if (redirect_uri) params.append("redirect_uri", redirect_uri);
  if (code_verifier) params.append("code_verifier", code_verifier);

  const tokenUrl = (TIKTOK_TOKEN_URL || "https://open.tiktokapis.com/v2/oauth/token").replace(/\/+$/, "");
  const url = tokenUrl; // use as-is

  if (!_fetch) throw new Error("No fetch available in this runtime");

  const res = await _fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: params.toString(),
  });

  const raw = await res.text().catch(() => "");
  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch (e) {
    const err = new Error(`TikTok token exchange returned non-JSON: ${raw.slice(0, 1000)}`);
    err.raw = raw;
    throw err;
  }

  if (!res.ok) {
    const err = new Error("TikTok token endpoint error");
    err.status = res.status;
    err.body = json;
    throw err;
  }

  // Expect an access_token in token response
  const accessToken = json.access_token || json.data?.access_token;
  if (!accessToken) {
    const err = new Error("No access_token returned from TikTok token exchange");
    err.body = json;
    throw err;
  }

  return json;
}

/**
 * Fetch user info from TikTok using multiple strategies and normalize shape.
 * Accepts tokenResponse object from exchangeTikTokCode (raw).
 *
 * Returns normalized object:
 * { raw: <original json>, open_id, display_name, avatar }
 *
 * May throw if the fetch fails badly, but will try multiple fallbacks.
 */
export async function fetchTikTokUserInfo(tokenResponse = {}) {
  if (!_fetch) throw new Error("No fetch available in this runtime");

  // Try to extract access token & open_id from many possible shapes
  const accessToken =
    tokenResponse.access_token ||
    tokenResponse.data?.access_token ||
    tokenResponse?.tokens?.access_token ||
    null;

  const openId =
    tokenResponse.open_id ||
    tokenResponse.data?.open_id ||
    tokenResponse.openid ||
    tokenResponse.data?.openid ||
    tokenResponse?.tokens?.open_id ||
    null;

  // Prepare a list of candidate request strategies (ordered)
  // 1) Authorization: Bearer header to the canonical userinfo endpoint
  // 2) Query params: ?access_token=...&open_id=...
  // 3) Try alternate endpoints (legacy shapes) — attempt same endpoint with common param names
  const tried = [];

  async function tryHeader() {
    try {
      const url = TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/";
      const resp = await _fetch(url, {
        method: "GET",
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
          "Content-Type": "application/json",
        },
      });
      const text = await resp.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (e) {
        return { ok: false, reason: "non-json", raw: text, status: resp.status };
      }
      return { ok: resp.ok, status: resp.status, json, rawText: text };
    } catch (e) {
      return { ok: false, reason: e.message || "fetch_error" };
    }
  }

  async function tryQueryParams() {
    try {
      const base = (TIKTOK_USERINFO_URL || "https://open.tiktokapis.com/v2/user/info/").replace(/\/+$/, "");
      const url = new URL(base);
      if (accessToken) url.searchParams.set("access_token", accessToken);
      if (openId) url.searchParams.set("open_id", openId);
      // also try openid param name just in case
      if (!openId) url.searchParams.set("open_id", "");
      const resp = await _fetch(url.toString(), { method: "GET" });
      const text = await resp.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (e) {
        return { ok: false, reason: "non-json", raw: text, status: resp.status };
      }
      return { ok: resp.ok, status: resp.status, json, rawText: text };
    } catch (e) {
      return { ok: false, reason: e.message || "fetch_error" };
    }
  }

  // Helper to extract user object from various TikTok shapes
  function extractUserFromJson(json) {
    if (!json) return null;

    // Several shapes:
    // { data: { user: { ... } } }
    // { data: { ... } }
    // { user: { ... } }
    // { open_id: "...", display_name: "...", avatar: "..." }
    const candidate =
      (json.data && (json.data.user || json.data)) ||
      json.user ||
      json || {};

    // try many field names
    const open_id =
      candidate.open_id ||
      candidate.openId ||
      candidate.openid ||
      candidate.id ||
      json.open_id ||
      json.openId ||
      json.openid ||
      null;

    const display_name =
      candidate.display_name ||
      candidate.nickname ||
      candidate.unique_id ||
      candidate.displayName ||
      candidate.name ||
      candidate.username ||
      candidate.screen_name ||
      null;

    const avatar =
      candidate.avatar ||
      candidate.avatar_url ||
      candidate.avatarUrl ||
      candidate.avatar_large ||
      candidate.avatar_large_url ||
      candidate.avatarLarge ||
      candidate.profile_image_url ||
      candidate.profile_picture ||
      null;

    // Some providers put nested user under `data.user`
    return {
      open_id: open_id || null,
      display_name: display_name || null,
      avatar: avatar || null,
      candidate,
    };
  }

  // 1) Try header method
  const headerResp = await tryHeader();
  tried.push({ method: "header", result: headerResp });

  if (headerResp && headerResp.ok && headerResp.json) {
    const result = extractUserFromJson(headerResp.json);
    if (result && (result.open_id || result.display_name || result.avatar)) {
      return { raw: headerResp.json, open_id: result.open_id, display_name: result.display_name, avatar: result.avatar };
    }
  }

  // 2) Try query params
  const queryResp = await tryQueryParams();
  tried.push({ method: "query", result: queryResp });
  if (queryResp && queryResp.ok && queryResp.json) {
    const result = extractUserFromJson(queryResp.json);
    if (result && (result.open_id || result.display_name || result.avatar)) {
      return { raw: queryResp.json, open_id: result.open_id, display_name: result.display_name, avatar: result.avatar };
    }
  }

  // 3) Try a few alternate fetch attempts with slightly different URLs (legacy)
  // sometimes the endpoint expects trailing slash or path /user/info instead of /v2/user/info/
  const altBases = [
    "https://open.tiktokapis.com/user/info/",
    "https://open.tiktokapis.com/v2/user/info/",
    "https://open.tiktokapis.com/v2/user/info", // no trailing
    "https://open.tiktokapis.com/oauth/userinfo", // sometimes used
  ];

  for (const base of altBases) {
    try {
      const url = new URL(base);
      if (accessToken) url.searchParams.set("access_token", accessToken);
      if (openId) url.searchParams.set("open_id", openId);
      const resp = await _fetch(url.toString(), { method: "GET", headers: { Authorization: accessToken ? `Bearer ${accessToken}` : "" } });
      const txt = await resp.text();
      let json;
      try { json = txt ? JSON.parse(txt) : {}; } catch (e) { continue; }
      const result = extractUserFromJson(json);
      if (result && (result.open_id || result.display_name || result.avatar)) {
        return { raw: json, open_id: result.open_id, display_name: result.display_name, avatar: result.avatar };
      }
      tried.push({ method: "alt:" + base, ok: resp.ok, status: resp.status, sample: Object.keys(json || {}).slice(0,5) });
    } catch (e) {
      tried.push({ method: "alt:" + base, error: String(e) });
    }
  }

  // All attempts failed to extract meaningful profile — but we'll still return the last json responses if any
  // Prefer headerResp.json > queryResp.json > null
  const fallbackJson = headerResp?.json || queryResp?.json || null;
  const fallbackExtract = extractUserFromJson(fallbackJson || {});

  return { raw: fallbackJson, open_id: fallbackExtract.open_id, display_name: fallbackExtract.display_name, avatar: fallbackExtract.avatar, tried };
}
