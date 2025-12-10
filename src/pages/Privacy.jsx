import React from "react";

export default function Privacy() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Privacy Policy for LeaderBox</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>1. The Information We Collect:</strong><br />
            TikTok login info (and soon, Letterboxd login info too).<br />
            Leaderbox collects your Tiktok data for login and content sharing porpuses only.<br />
            Upon signing up the user must create an ID through which they'll be identified.
            Leaderbox won't display your Tiktok page or identification within the website.</p>

          <p><strong>2. How We Use Your Information:</strong><br />
          To personalize your experience.<br />
          To improve our website by making it easy to sign in.<br />
          And to facilitate content sharing.</p>

          <p><strong>3. Data Sharing:</strong><br />
          Leader Box does not sell or share your personal data with third parties in any way.</p>

          <p><strong>4. Data Security:</strong><br />
          Leader Box implements measures to protect your data.</p>

          <p><strong>5. Your Rights:</strong><br />
          You can request deletion of your data at any time.</p>

          
          <p><strong>6. Movie data:</strong><br />
          The movie posters and the movie statistics (such as critics score, popularity, etc) utilized on the website are courtesy of
            <a href="https://www.themoviedb.org/" target="_blank" style={{ color: "var(--redlink)" }}>TMDB</a>.</p>

          <p><strong>7. Contact Information:</strong><br />
            <a href="https://www.tiktok.com/@ricks_a_human" target="_blank" style={{ color: "var(--redlink)" }}>@Ricks_a_human</a> on TikTok for management suppport.<br />
          Email: <a href="mailto:leaderbox_management@outlook.com" style={{ color: "var(--redlink)" }}>leaderbox_management@outlook.com</a> for legal or business porposes.</p>

          <p><strong>8. Support the website:
          Leaderbox is not a paid service! Any form of support is voluntary and could be done so via subscribing to Rick's a Human's <a href="https://www.youtube.com/@ricksahuman" target="_blank" style={{ color: "var(--redlink)" }}>Patreon </a>
            or <a href="https://www.youtube.com/@ricksahuman" target="_blank" style={{ color: "var(--redlink" }}>Youtube!</a><br />
            Please also support <a className="small" href="https://www.youtube.com/@JangoDisc" target="_blank" rel="noreferrer" style={{color:"var(--redlink)",marginLeft:8}}>JangoDisc </a>on Youtube, as his visual style was the inspiration for the website.</strong></p>
        </div>
      </div>
    </div>
  );
}
