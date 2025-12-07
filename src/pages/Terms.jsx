// src/pages/Terms.jsx
import React from "react";

export default function Terms() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Terms of Service for LeaderBox</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>1. Acceptance of Terms</strong><br />
          By using LeaderBox, you agree to these terms.</p>

          <p><strong>2. Use of App</strong><br />
          - You may not misuse the app or attempt unauthorized access.<br />
          - You agree to provide accurate info when logging in.</p>

          <p><strong>3. Intellectual Property</strong><br />
          - All content is owned by LeaderBox.</p>

          <p><strong>4. Limitation of Liability</strong><br />
          - We are not responsible for user-generated content or TikTok data errors.</p>

          <p><strong>5. Termination</strong><br />
          - We may suspend accounts for violations.</p>

          <p><strong>6. Contact</strong><br />
          Email: <a href="mailto:leaderbox_management@outlook.com" style={{ color: "var(--accent)" }}>leaderbox_management@outlook.com</a></p>
        </div>
      </div>
    </div>
  );
}
