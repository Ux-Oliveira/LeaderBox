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
    if (!open_id) return { ok: false, error: "missing_open_id" };
    // serverless supports either query param or path; we use query param for consistency
    const res = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`, { credentials: "same-origin" });
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

export async function deleteProfile(open_id) {
  try {
    if (!open_id) return { ok: false, error: "missing_open_id" };
    // some servers expect DELETE at /api/profile?open_id=...
    const res = await fetch(`/api/profile?open_id=${encodeURIComponent(open_id)}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const txt = await res.text();
      let p = null;
      try { p = JSON.parse(txt); } catch (e) { p = txt; }
      return { ok: false, error: p };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
