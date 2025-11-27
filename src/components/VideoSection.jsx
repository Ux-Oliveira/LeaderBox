import React from "react";
import { useNavigate } from "react-router-dom"

export default function VideoSection() {
 const nav = useNavigate();
 return (
    <div className="video-section card">
        <video src="/" controls muted loop playsInline />
        <button className="duel-button" onClick={()=>nav("/duel")}>DUEL NOW!</button>
    </div>
 );
}