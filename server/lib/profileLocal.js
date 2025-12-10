// src/lib/profileLocal.js
const LOCAL_KEY = "stored_profile";
const TIKTOK_PROFILE_KEY = "tiktok_profile";
const TIKTOK_TOKENS_KEY = "tiktok_tokens";

/**
 * Normalize and persist only safe fields.
 * Nickname stored WITHOUT leading '@' to keep client UI consistent.
 */
export function saveProfileToLocal(p) {
  try {
    if (!p || typeof p !== "object") return;
    const rawNick = p.nickname || p.handle || (p.raw && (p.raw.data?.user?.display_name || p.raw.data?.display_name)) || null;
    const cleanedNick = rawNick ? String(rawNick).trim().replace(/^@/, "") : null;

    const safe = {
      open_id: p.open_id || p.openId || (p.raw && p.raw.data && p.raw.data.open_id) || null,
      nickname: cleanedNick, // store without '@'
      avatar: p.avatar || p.pfp || (p.raw && (p.raw.data?.user?.avatar || p.raw.avatar)) || null,
      wins: Number.isFinite(p.wins) ? p.wins : 0,
      losses: Number.isFinite(p.losses) ? p.losses : 0,
      draws: Number.isFinite(p.draws) ? p.draws : 0, // <-- added draws
      level: Number.isFinite(p.level) ? p.level : 1,
      deck: Array.isArray(p.deck) ? p.deck : [],
      // keep minimal meta for debugging but avoid tokens
      meta: p.meta || null,
      raw: undefined
    };

    localStorage.setItem(LOCAL_KEY, JSON.stringify(safe));
    localStorage.setItem(TIKTOK_PROFILE_KEY, JSON.stringify(safe));
    // DO NOT store tokens here (prefer server-side secure cookies or "tiktok_tokens" key)
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
    // tokens intentionally not removed here (caller may prefer preserving tokens)
  } catch (e) {
    // ignore
  }
}
