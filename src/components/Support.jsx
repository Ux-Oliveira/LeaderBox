import React from "react";

export default function Support(){
    return (
     <div>
        <div className="support card">
            <div className="left">
                <div className="small">Based on JangoDisc's video!
                <a className="small" href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:8}}>
                    <i className="fa fa-youtube"/> Youtube {/*I'll setup the fontawesome icon later*/}
                </a>
            </div>

            <div style={{flex:1}} />
            
            <div className="righ">
                <a className="small" href="https://www.youtube.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginRight:8}}>
                    <i className="fa fa-youtube"/> Youtube
                </a>
                <div className="small">Website by Rick's a Human</div>
            </div>
         </div>
        </div>
     </div>
    );
}

{/*BOTH THE SUPPORT AND THE VIDEO SECTION FILES ARE PRETTY BASIC AT THE MOMENT CAUSE ILL FIRST FOCUS ON GETTING THE PROFILE SET UP AND MANAGEMENT SIDE OF THINGS READY*/}
