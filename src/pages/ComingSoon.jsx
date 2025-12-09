import React from "react";
import Support from "../components/Support";

export default function Privacy() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">Privacy Policy for LeaderBox</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>Hi, you'll be able to Sign up with Letterboxd soon</strong><br />
          Hang in there...</p>
        </div>
      </div>
      <Support />
    </div>
  );
}
