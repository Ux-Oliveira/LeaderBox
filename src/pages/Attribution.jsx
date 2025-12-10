import React from "react";

export default function Attribution() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Privacy Policy for LeaderBox</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p>
            <strong>This page is dedicated to special attributions:</strong>
            <br />
            <a
              className="small"
              href="https://www.youtube.com/@JangoDisc"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--redlink)", fontWeight: "bold", marginLeft: 8 }}
            >JangoDisc
            </a>{" "}
            for the visual style and conceptual inspiration;
            <br />
          </p>

          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
           <h1 className="h1-retro">Movie posters and statistics:</h1>
            <p></p><strong>Source of The Movie Database <a
              className="small"
              href="https://www.youtube.com/@JangoDisc"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--redlink)", fontWeight: "bold", marginLeft: 8 }}
            >(TMDB)</a>{" "}.</strong><br />
            <img />  
          </div>


          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>Music and sound effects found on freesound.org:</strong><br />
            








            
          </p>
        </div>
      </div>
    </div>
  );
}
