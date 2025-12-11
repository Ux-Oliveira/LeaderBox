// src/pages/Attribution.jsx
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
              style={{ color: "var(--accent)", fontWeight: "bold", marginLeft: 8 }}
            >
              JangoDisc
            </a>{" "}
            for the visual style and conceptual inspiration;
          </p>

          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
            <h2 className="h1-retro" style={{ fontSize: 20, marginTop: 8 }}>
              Movie posters and statistics
            </h2>

            <p style={{ marginTop: 8 }}>
              <strong>
                Source: The Movie Database
                <a
                  className="small"
                  href="https://www.themoviedb.org"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", fontWeight: "bold", marginLeft: 8 }}
                >
                  (TMDB)
                </a>
                .
              </strong>
            </p>

            {/* optional decorative image placeholder — replace src with a real asset if desired */}
            <div style={{ marginTop: 12 }}>
               <a
                  className="small"
                  href="https://www.themoviedb.org"
                  target="_blank"
                  rel="noreferrer"><img
                src="/tmdb.svg"
                alt="TMDB Logo"
                style={{ maxWidth: "100%", height: "auto", borderRadius: 6, display: "block" }}
              /></a>
            </div>
          </div>

          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
            <p>
              <strong>Music and sound effects:</strong>
              <br />
              Many sound effects and background music used during development and in prototypes
              were sourced from freesound.org and various royalty-free collections. Please consult
              each audio file's license when publishing.
            </p>

            <ul style={{ marginTop: 8, color: "rgba(255,255,255,0.88)" }}>
              <li>
                Freesound.org (soundFX) — attribution where required by contributor license.
              </li>
              <li>Royalty-free collections (various artists) — check individual track licenses.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
