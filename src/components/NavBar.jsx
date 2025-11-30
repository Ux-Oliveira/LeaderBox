// src/components/NavBar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function NavBar({ user, onOpenProfile }) {
  const nav = useNavigate();
  const pfp = user?.pfp || user?.avatar || null;

  return (
    <div className="navbar">
      <div className="brand" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div className="logo" />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <div style={{ fontSize: 14, color: "var(--accent)" }}>LeaderBox</div>
          <div className="small">Your movie taste sucks</div>
        </div>
      </div>

      <div className="navLinks">
        <Link to="/">Home</Link>
        <Link to="/duel">Duel</Link>
        <Link to="/rules">Rules</Link>

        {/* Always show a Profile link/button so users can navigate to /profile */}
        <button
          className="btn"
          onClick={() => nav("/profile")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.04)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer"
          }}
        >
          {pfp ? (
            <img src={pfp} alt="pfp" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }} />
          ) : (
            <i className="fa fa-user" />
          )}
          Profile
        </button>

        {!user ? (
          <>
            <Link
              to="/signup"
              className="btn"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", padding: "8px 12px" }}
            >
              Sign up
            </Link>
            <Link to="/login" className="btn" style={{ background: "var(--accent)", color: "var(--black)", padding: "8px 12px" }}>
              Log in
            </Link>
          </>
        ) : (
          <>
            {/* Profile modal opener */}
            <button className="btn" onClick={() => onOpenProfile()}>
              Open
            </button>
          </>
        )}
      </div>
    </div>
  );
}
