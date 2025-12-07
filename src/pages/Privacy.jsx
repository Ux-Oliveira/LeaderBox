import React from "react";

export default function Privacy() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Privacy Policy for LeaderBox</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>1. Information We Collect</strong><br />
          - TikTok login info (username, user ID, profile picture)<br />
          - Any data you provide within the app</p>

          <p><strong>2. How We Use Information</strong><br />
          - To personalize your experience<br />
          - To improve our app</p>

          <p><strong>3. Data Sharing</strong><br />
          - We do not sell or share your personal data with third parties</p>

          <p><strong>4. Data Security</strong><br />
          - We implement measures to protect your data</p>

          <p><strong>5. Your Rights</strong><br />
          - You can request deletion of your data at any time</p>

          <p><strong>6. Contact</strong><br />
          Email: <a href="mailto:leaderbox_management@outlook.com" style={{ color: "var(--accent)" }}>leaderbox_management@outlook.com</a></p>
        </div>
      </div>
    </div>
  );
}
