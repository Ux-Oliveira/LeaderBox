import React from "react";

export default function Support(){
    return (
     <div>
        <div className="support card">
            <div className="left">
                <div className="small">Based on JangoDisc's video!</div>
                <a className="small" href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:8, display: "flex", alignItems: "center", gap: 6}}>
                    <i className="fa fa-youtube"/> Youtube {/*I'll setup the fontawesome icon later*/}
                </a>
            </div>

            <div style={{flex:1}} />

            <div className="right" style={{display: "flex", alignItems: "center", gap: 8}}>
                <div className="small">Website by Rick's a Human</div>
                <a className="small" href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:8, display: "flex", alignItems: "center", gap: 6}}>
                    <i className="fa fa-youtube"/> Youtube
                </a>
            </div>
         </div>
        </div>
     </div>
    );
}
