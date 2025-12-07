import React from "react";

export default function Support() {
  return (
    <div className="support-center-wrapper">
      <div className="support card">
        <div className="left">
          <div className="small">
            Inspired by{" "}
            <a
              className="small"
              href="https://www.youtube.com/@JangoDisc"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", marginLeft: 8 }}
            >
              JangoDisc
            </a>{" "}
            | Website by
            <a
              className="small"
              href="https://www.youtube.com/@ricksahuman"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", marginLeft: 8 }}
            >
              Rick's a Human
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
