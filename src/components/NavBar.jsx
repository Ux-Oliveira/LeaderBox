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

  return (
    <>
      <div className="navbar">
        <div className="brand" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* replaced square by image ldr-logo.png */}
          <img src="/ldr-logo.png" alt="LeaderBox" className="logo-img" />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <div style={{ fontSize: 14, color: "var(--accent)" }}>LeaderBox</div>
            <div className="small">Your movie taste sucks</div>
          </div>
        </div>

        <div className="navRight">
          <div className="navLinks" style={{ alignItems: "center" }}>
            {/* Home icon */}
            <button
              className="nav-icon"
              title="Home"
              onClick={() => nav("/")}
              aria-label="Home"
            >
              <i className="fa-regular fa-house" />
            </button>

            {/* Duel - gif icon sized like the fontawesome icons */}
            <button
              className="nav-icon"
              title="Duel"
              onClick={() => nav("/duel")}
              aria-label="Duel"
            >
              <img src="/duel.gif" alt="duel" className="icon-gif" />
            </button>

            {/* Rules (ruler) */}
            <button
              className="nav-icon"
              title="Rules"
              onClick={() => nav("/rules")}
              aria-label="Rules"
            >
              <i className="fa-solid fa-ruler" />
            </button>

            {/* Profile link (always present as icon). When signed out it still goes to /profile */}
            <button
              className="nav-icon"
              title="Profile"
              onClick={() => nav("/profile")}
              aria-label="Profile"
              style={{ marginLeft: 6 }}
            >
              <i className="fa-regular fa-address-card" />
            </button>

            {/* Signup / Login to the left of hamburger */}
            {!user ? (
              <>
                <button
                  className="nav-signup"
                  onClick={() => nav("/signup")}
                  title="Sign up"
                  style={{ marginLeft: 12 }}
                >
                  Sign up
                </button>
                <button
                  className="nav-login"
                  onClick={() => nav("/login")}
                  title="Log in"
                  style={{ marginLeft: 8 }}
                >
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
                {/* overlay to capture outside clicks and make it disappear when clicked */}
                <div className="click-overlay" onClick={() => setDropdownOpen(false)} />

                <div ref={dropdownRef} id="nav-dropdown" className="dropdown-panel" role="menu">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a
                      className="modal-btn"
                      href="https://www.patreon.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <i className="fa-brands fa-patreon" style={{ width: 20 }} />
                      Support
                    </a>

                    {/* privacy + terms only present here */}
                    <button
                      className="modal-btn"
                      onClick={() => {
                        window.location.href = "/privacy.html";
                        setDropdownOpen(false);
                      }}
                    >
                      Privacy Policy
                    </button>
                    <button
                      className="modal-btn"
                      onClick={() => {
                        window.location.href = "/terms.html";
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
      <div className="bg-gif" aria-hidden="true" />
    </>
  );
}
