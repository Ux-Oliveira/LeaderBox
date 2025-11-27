import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function NavBar({ user , onOpenProfile }) {
 const nav = useNavigate();
 return (
  <div className="navbar">
    <div className="brand">
        <div className="logo"></div>
        <div style={{display:"flex", flexDirection:"column",lineHeight:1}}>
            <div style={{fontSize: 14, color:"var(--accent)"}}>LeaderBox</div>
            <div className="small">Your movie taste sucks</div>
        </div>
    </div>

  <div className="navLinks">
   <Link to="/">Home</Link>
   <Link to="/duel">Duel</Link>
   <Link to="/rules">Rules</Link>
   {!user ? (
    <>
     <Link to="/signup" className="btn" style={{background:"transparent",border:"1px solid rgba(255,255,255,0.06)",padding:"8px 12px"}}>
     </Link>
     <Link to="/login" className="btn" style={{background:"var(--accent)", color:"var(--black)"}}>
     </Link>
    </>
   ) : (
    <>
     <button className="btn" onClick={()=>onOpenProfile()}>Profile</button>
    </>
   )}
   </div>
  </div>
 );
}