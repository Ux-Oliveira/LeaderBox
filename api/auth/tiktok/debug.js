export default async function handler(req, res) {
  try {
    const tokenUrl = process.env.TIKTOK_TOKEN_URL || null;
    const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY || null;
    const clientSecretPresent = !!process.env.TIKTOK_CLIENT_SECRET;
    const env = {
      debug: true,
      method: req.method,
      TIKTOK_TOKEN_URL_env: tokenUrl,
      using_default_tokenUrl: tokenUrl ? false : true,
      TIKTOK_CLIENT_KEY_present: !!clientKey,
      TIKTOK_CLIENT_KEY_value_snippet: clientKey ? (clientKey.substring(0,6) + "...") : null,
      TIKTOK_CLIENT_SECRET_present: clientSecretPresent
    };
    return res.status(200).json(env);
  } catch (err) {
    return res.status(500).json({ error: "debug handler error", details: String(err) });
  }
}
