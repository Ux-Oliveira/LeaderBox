// server/index.js, exchange endpoint
app.post("/api/auth/tiktok/exchange", async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body;

    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!redirect_uri) return res.status(400).json({ error: "Missing redirect_uri" });

    const tokenJson = await exchangeTikTokCode({ code, code_verifier, redirect_uri });

    res.cookie("sessionId", randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ ok: true, tokens: tokenJson, redirectUrl: "/" });
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
});
