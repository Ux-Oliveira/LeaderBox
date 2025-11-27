import React, { useEffect, useState } from "react";

const LEVELS = [ //ill define the levels each profile can reach and the threshold to level up
    {level:1, name:"Noob", threshold:0},
    {level:2, name:"Casual Viewer", threshold:5},
    {level:3, name:"Youtuber Movie Critic", threshold:11},
    {level:4, name:"Movie Festival Goer", threshold:18},
    {level:5, name:"Indie Afficionado", threshold:26},
    {level:6, name:"Cult Classics Schoolar", threshold:35},
    {level:7, name:"Film Buff", threshold:45},
    {level:8, name:"Film Curator", threshold:56},
    {level:9, name:"Cinephile", threshold:68}, //i dont even know if there will be enough people for someone to duel 70 times lol
];

function getLevelByWins(wins){
    let current = LEVELS[0];
    for(let i=LEVELS.length-1;i>=0;i--){
        if(wins >= LEVELS[i].threshold){current = LEVELS[i]; break; }
    } //these variables will determine your level by number of wins
    return current;
}

export default function ProfileModal({ open=false, onClose=()=>{}, user=null, onLogout=()=>{} , onUpdateUser=()=>{} }){
    const [isOpen,setOpen] = useState(open);
    useEffect(()=> setOpen(open),[open]);

    useEffect(()=> {
    }, []);

async function doLogout(){
    await apiClient("/api/logout", { method: "POST" }).catch(()=>{});
    onLogout();
}

if(!user) return (
 <>
  <div className="profile-knob" onClick={()=> { setOpen(true); onClose && onClose(); }}>
    ?
  </div>
  <div className={`profile-modal ${isOpen ? "open" : ""}`}>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontWeight:900,color:"var(--accent)"}}>Profile</div>
            <div className="small">You must login to view profile</div>
                <button className="modal-btn" onClick={()=>{window.location.href="/login"}}>Login / Sign up</button>
            </div>
            <div style={{flex:1}} />
            <button className="modal-btn" onClick={()=>setOpen(false)}>Close</button>
        </div>
 </>
);

const level = getLevelByWins(user.wins || 0);

return (
    <>
     <div className="profile-knob" onClick={()=> setOpen(!isOpen)}>{isOpen ? "<" :  ">"}
     </div>
     <div className={`profile-modal ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div className="pfp"><img src={user.pfp} alt="pfp"/></div>
                <div>
                <div style={{fontWeight:900, color:"var(--accent)"}}>{user.nickname}</div>
                <div className="small">{user.email}</div>
            </div>
        </div>

        <hr style={{borderColor:"rgba(255,255,255,0.04)"}}/>

        <button className="modal-btn" onClick={()=> window.location.href="/profile"}>Edit Stack</button>

     <div style={{padding:"8px", borderRadius:8, background:"rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex", justifyContent:"space-between"}}>
            <div className="small">Wins</div>
            <div className="small">{user.wins || 0}</div>
        </div>
        <div style={{display:"flex", justifyContent:"space-between"}}>
            <div className="small">Losses</div>
            <div className="small">{user.losses || 0}</div>
        </div>
     </div>

     <button className="modal-btn">Change pfp</button>
     <button className="modal-btn">Change Password</button>
     <button className="modal-btn">Delete Profile</button>

     <hr style={{borderColor:"rgba(255,255,255,0.04)"}}/>

    <div>
        <div className="small" style={{color:"var(--accent)"}}>Level {level.level} - {level.name}</div>
        <div className="level-bar" style={{marginTop:8}}>{LEVELS.map(l => <div key={l.level} className="level-pill" style={{background:(l.level===level.level) ? "var(--accent)" : "transparent", color:(l.level===level.level) ? "var(--black)" : "var(--white)"}}>{l.level}</div>)}
        </div>
    </div>
   </div>

   <button className="modal-btn" onClick={doLogout}>Logout</button>
   </div>
 </>
);
}
