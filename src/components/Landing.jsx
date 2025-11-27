import React from "react";
import VideoSection from "./VideoSection";
import Support from "./Support";

export default function Landing(){
 return (
  <>
   <div style={{display:"grid",gap:14}}>
    <div className="card">
      <h1 className="h1-retro">Select your 4 favorite movies and build the perfect stack!</h1>
      <div className="subtitle">Choose your movies, craft your deck and duel against other cinephiles!
    </div>
   </div> 
   
   <VideoSection />

    <Support />
   </div>
  </>
 );
}