// src/lib/api.js
export async function fetchAllProfiles() {
  try {
    const res = await fetch("/api/profile");
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { ok: true, data: json };
    } catch (e) {
      return { ok: false, error: "non_json_response", raw: text };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function fetchProfileByOpenId(open_id) {
  try {
    const res = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!res.ok) return { ok: false, error: json };
      return { ok: true, profile: json.profile || json };
    } catch (e) {
      return { ok: false, error: "non_json_response", raw: text };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
