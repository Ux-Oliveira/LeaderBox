import React from "react";
import Support from "../components/Support";

export default function Rules() {
  return (
    <div className="page-wrapper landing" style={{ minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: 980, margin: "80px auto", padding: 28 }}>
        <h1 className="h1-retro">How does the game work?</h1>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
          <p><strong>1. General.</strong><br />
          Select your four favorite movies.<br />
          Each movie has especific stats that determine your movie points.<br />
          The opponent cannot see how many movie points you have at any point!<br />
          Depleat your oponents movie points to win.<br />
          </p>

            <p><strong>3. Movie Stacks and Stats.</strong><br />
             Each player must have at least 4 favorite movies selected in their stack.<br />
             4 stats determine your movie points: Quality, Rewatchability, Popularity and Pretensiouness.<br />
             And each movie has the same stats.<br />
            </p>

          <p><strong>2. Turns.</strong><br />
          Each duel has two turns. The person being challenged has the first turn.<br />
          Each movie selected "attacks" at once and if you survive you can have the next turn.<br />
          If you survived you can attack 4 times, once for each movie.
          Whoever has the more Movie Points by the end of the second turn wins. Draws are possible.</p>

            <p><strong>3. Attacks</strong><br />
          Each movie has an especific attack you can use just once.</p>
            
          <p><strong>4. Time out</strong><br />
          Once you fought an user you cannot do it again for, at least 15 minutes. Or until they changed their stack.</p>

          <p><strong>5. Sharability</strong><br />
          You can share the results of a battle on TikTok!.</p>
        </div>
      </div>
      <Support />
    </div>
  );
}
