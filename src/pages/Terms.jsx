import React from "react";

export default function Terms() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Terms of Service for Leader Box</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>1. Acceptance of Terms</strong><br />
          By using LeaderBox.co, you agree to the following terms:</p>

          <p><strong>2. Webapp usage:</strong><br />
          You may not misuse the app or attempt unauthorized access.<br />
          You may not harass other users in or outside the website.<br />
          You agree to provide accurate information when signing up/logging in.<br />
          You agree to not share yours or someone else's personal information in the website.
          </p>

          <p><strong>3. Intellectual Property:</strong><br />
          All content is owned by LeaderBox.
          Inspired by<a className="small" href="https://www.youtube.com/@JangoDisc" target="_blank" rel="noreferrer" style={{color:"var(--redlink)",marginLeft:8}}>JangoDisc</a>
          and produced by<a className="small" href="https://www.youtube.com/@ricksahuman" target="_blank" rel="noreferrer" style={{color:"var(--redlink)",marginLeft:8}}>Rick's a Human.</a></p>

          <p><strong>4. Movie data:</strong><br />
          The movie posters and the movie statistics (such as critics score, popularity, etc) utilized on the website are courtesy of
            <a href="https://www.themoviedb.org/" target="_blank" style={{ color: "var(--redlink)" }}>TMDB</a>.</p>
          
          <p><strong>5. Limitation of Liability:</strong><br />
          We are not responsible for user-generated content outside of the website.<br /> 
          We are not responsible for TikTok data errors.</p>
          We are not responsible for Letterboxd data errors.</p>

          <p><strong>5. Account Termination:</strong><br />
          We may suspend accounts for violations. Don't be a dick!</p>

          <p><strong>6. Contact Information:</strong><br />
            <a href="https://www.tiktok.com/@ricks_a_human" target="_blank" style={{ color: "var(--redlink)" }}>@Ricks_a_human</a> on TikTok for management suppport.<br />
          Email: <a href="mailto:leaderbox_management@outlook.com" style={{ color: "var(--redlink)" }}>leaderbox_management@outlook.com</a> for legal or business porposes.</p>

         <p><strong>8. Support the website:</strong><br />
          Leaderbox is not a paid service! Any form of support is voluntary and could be done so via subscribing to Rick's a Human's <a href="https://www.youtube.com/@ricksahuman" target="_blank" style={{ color: "var(--redlink)" }}>Patreon </a>
            or <a href="https://www.youtube.com/@ricksahuman" target="_blank" style={{ color: "var(--redlink" }}>Youtube!</a><br />
            Please also support <a className="small" href="https://www.youtube.com/@JangoDisc" target="_blank" rel="noreferrer" style={{color:"var(--redlink)",marginLeft:8}}>JangoDisc </a>on Youtube, as his visual style was the inspiration for the website.</p>
        </div>
      </div>
    </div>
  );
}
