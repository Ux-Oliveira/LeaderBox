export default async function handler(req, res) {
  // Simple debug: return the TIKTOK_TOKEN_URL seen by the running function
  try {
    const url = process.env.TIKTOK_TOKEN_URL || null;
    const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY || null;
    const clientSecretPresent = !!process.env.TIKTOK_CLIENT_SECRET;
    return res.status(200).json({
      debug: true,
      TIKTOK_TOKEN_URL_env: url,
      using_default: url ? false : true,
      TIKTOK_CLIENT_KEY_present: !!clientKey,
      TIKTOK_CLIENT_SECRET_present: clientSecretPresent
    });
  } catch (err) {
    return res.status(500).json({ error: "handler error", details: String(err) });
  }
}
