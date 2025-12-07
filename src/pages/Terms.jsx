import React from "react";

export default function Terms() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Terms of Service for LeaderBox</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>1. Acceptance of Terms</strong><br />
          By using LeaderBox.co, you agree to the following terms.</p>

          <p><strong>2. Use of App</strong><br />
          You may not misuse the app or attempt unauthorized access.<br />
          You may not harass other users.<br />
          You agree to provide accurate information when signing up/logging in.
          You agree to not share yours or someone else's personal information in the website.
          </p>

          <p><strong>3. Intellectual Property</strong><br />
          All content is owned by LeaderBox.
          Inspired by<a className="small" href="https://www.youtube.com/@JangoDisc" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:8}}>JangoDisc</a> and produced by<a className="small" href="https://www.youtube.com/@ricksahuman" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:8}}>Rick's a Human.</a></p>

          <p><strong>4. Limitation of Liability</strong><br />
          We are not responsible for user-generated content outside of the website.<br /> 
          We are not responsible for TikTok data errors.</p>

          <p><strong>5. Termination</strong><br />
          We may suspend accounts for violations.</p>

          <p><strong>6. Contact</strong><br />
          You can contact me via email for legal or business porposes.<br />Or via TikTok (<a href="https://www.tiktok.com/@ricks_a_human"
                                                                                        target="_blank" style={{ color: "var(--accent)" }}>@Ricks_a_human</a>) for management suppport.<br />  
          Email: <a href="mailto:leaderbox_management@outlook.com" style={{ color: "var(--accent)" }}>leaderbox_management@outlook.com</a></p>
        </div>
      </div>
    </div>
  );
}
