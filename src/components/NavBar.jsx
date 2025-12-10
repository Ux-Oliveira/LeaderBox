import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function NavBar({ user, onOpenProfile }) {
  const nav = useNavigate();
  const pfp = user?.pfp || user?.avatar || null;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleDocClick(e) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleDocClick);
    }
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [dropdownOpen]);

  function handleProfileClick() {
    if (user) {
      // prefer nickname slug (without @) — as requested
      const slug = (user.nickname && String(user.nickname).replace(/^@/, "").trim()) || user.open_id || null;
      if (slug) {
        nav(`/profile/${encodeURIComponent(slug)}`);
        return;
      }
    }
    // fallback to general profile page
    nav("/profile");
  }

  return (
    <>
      <div className="navbar">
        {/* Branding - removed inline style so CSS media query can hide it on mobile */}
        <div className="brand">
          <img src="/ldr-logo.png" alt="LeaderBox" className="logo-img" />
          <div className="brand-text">
            <div className="brand-title">LeaderBox</div>
            <div className="small">Your movie taste sucks</div>
          </div>
        </div>

        {/* navRight contains the icons and hamburger; centered on mobile via CSS */}
        <div className="navRight">
          <div className="navLinks" style={{ alignItems: "center" }}>
            {/* Home icon */}
            <button className="nav-icon" title="Home" onClick={() => nav("/")} aria-label="Home">
              <i className="fa-regular fa-house" />
            </button>

            {/* Duel - gif icon sized like the fontawesome icons */}
            <button className="nav-icon" title="Duel" onClick={() => nav("/duel")} aria-label="Duel">
              <img src="/duel.gif" alt="duel" className="icon-gif" />
            </button>

            {/* Rules (ruler) */}
            <button className="nav-icon" title="Rules" onClick={() => nav("/rules")} aria-label="Rules">
              <i className="fa-solid fa-ruler" />
            </button>

            {/* Profile link */}
            <button
              className="nav-icon"
              title="Profile"
              onClick={handleProfileClick}
              aria-label="Profile"
              style={{ marginLeft: 6 }}
            >
                <i className="fa-regular fa-address-card" />
            </button>

            {/* Signup / Login — hidden on mobile via CSS */}
            {!user ? (
              <>
                <button className="nav-signup" onClick={() => nav("/signup")} title="Sign up" style={{ marginLeft: 12 }}>
                  Sign up
                </button>
                <button className="nav-login" onClick={() => nav("/login")} title="Log in" style={{ marginLeft: 8 }}>
                  Log in
                </button>
              </>
            ) : null}
          </div>

          {/* Hamburger */}
          <div style={{ position: "relative" }}>
            <div
              className="hamburger"
              onClick={() => setDropdownOpen((s) => !s)}
              aria-expanded={dropdownOpen}
              aria-controls="nav-dropdown"
              role="button"
              title="Menu"
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </div>

            {dropdownOpen && (
              <>
                <div className="click-overlay" onClick={() => setDropdownOpen(false)} />
                <div ref={dropdownRef} id="nav-dropdown" className="dropdown-panel" role="menu">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a
                      className="modal-btn"
                      id="patreon"
                      href="https://www.patreon.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <i className="fa-brands fa-patreon" style={{ width: 20 }} />
                      Join the Patreon!
                    </a>

                    <button
                      className="modal-btn"
                      onClick={() => {
                        nav("/privacy");
                        setDropdownOpen(false);
                      }}
                    >
                      Privacy Policy
                    </button>
                    <button
                      className="modal-btn"
                      onClick={() => {
                        nav("/terms");
                        setDropdownOpen(false);
                      }}
                    >
                      Terms of Service
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* persistent background gif element (below navbar) */}
      {/* REMOVED duplicate bg-gif from here — App.jsx now renders a single .bg-gif for the whole app */}
    </>
  );

}
