// src/lib/profileLocal.js
const LOCAL_KEY = "stored_profile";
const TIKTOK_PROFILE_KEY = "tiktok_profile";
const TIKTOK_TOKENS_KEY = "tiktok_tokens";

/**
 * Normalize and persist only safe fields.
 * Accepts the server-returned profile object (which should *not* contain raw OAuth tokens).
 */
export function saveProfileToLocal(p) {
  try {
    if (!p || typeof p !== "object") return;
    const safe = {
      open_id: p.open_id || (p.openId || null),
      nickname: p.nickname || (p.handle ? String(p.handle).replace(/^@/, "") : null) || null,
      // ensure stored avatar field is `avatar`
      avatar: p.avatar || p.pfp || null,
      wins: Number.isFinite(p.wins) ? p.wins : 0,
      losses: Number.isFinite(p.losses) ? p.losses : 0,
      level: Number.isFinite(p.level) ? p.level : 1,
      deck: Array.isArray(p.deck) ? p.deck : [],
      // optionally keep small debug `meta` (no tokens).
      meta: p.meta || null,
    };
    // Save under two keys to preserve previous code paths
    localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
    localStorage.setItem(TIKTOK_PROFILE_KEY, JSON.stringify(safe));
    // Do NOT save tokens here. If you must store tokens, use "tiktok_tokens" but prefer server-side storage.
  } catch (e) {
    console.warn("Failed saving profile:", e);
  }
}

export function loadProfileFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY) || localStorage.getItem(TIKTOK_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed reading profile from localStorage:", e);
    return null;
  }
}

export function clearLocalProfile() {
  try {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(TIKTOK_PROFILE_KEY);
    // DO NOT automatically remove server-side saved profile. Clearing local preview only.
  } catch (e) {
    // ignore
  }
}
