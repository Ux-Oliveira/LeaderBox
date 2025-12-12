// src/pages/DuelPlay.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const BACKGROUND_SONGS = [
  "/audios/city_battle_stars.mp3",
  "/audios/cinematic_battle.mp3",
  "/audios/fun_battle.mp3",
  "/audios/retro_battle.mp3",
];
const SLOT_AUDIO = "/audios/slot.mp3";
const SILENT_AUDIO = "/audios/silent.mp3";
const READYGO_AUDIO = "/audios/readygo.mp3";
const WOOSH_AUDIO = "/audios/woosh.mp3";
const MOVE_AUDIO = "/audios/move.mp3";
const DAMAGE_AUDIO = "/audios/demage.mp3";
const NUMBERS_AUDIO = "/audios/numbers.mp3";
const LOSE_AUDIO = "/audios/lose.mp3";
const LOSE_GIF = "/images/lose.gif";

// fake audio to initiate audio playing
function posterFor(movie) {
  if (!movie) return null;
  if (movie.poster_path) return `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
  if (movie.poster) return movie.poster;
  if (movie.image) return movie.image;
  if (movie.posterUrl) return movie.posterUrl;
  if (movie.raw && movie.raw.poster_path) return `https://image.tmdb.org/t/p/w342${movie.raw.poster_path}`;
  if (movie.raw && movie.raw.poster) return movie.raw.poster;
  return null;
}

/* small helper to fetch profile by slug or open_id */
async function fetchProfileBySlug(slug) {
  if (!slug) return null;
  // try nickname first
  try {
    const byNick = await fetch(`/api/profile?nickname=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byNick.ok) {
      const txt = await byNick.text();
      try { const json = JSON.parse(txt); return json.profile || json; } catch(e){}
    }
  } catch(e){}
  // fallback by open_id
  try {
    const byId = await fetch(`/api/profile?open_id=${encodeURIComponent(slug)}`, { credentials: "same-origin" });
    if (byId.ok) {
      const txt = await byId.text();
      try { const json = JSON.parse(txt); return json.profile || json; } catch(e){}
    }
  } catch(e){}
  return null;
}

/* compute stats using same algorithm as EditStack */
function computeStats(deckArr) {
  const movies = (deckArr || []).filter(Boolean);
  if (movies.length === 0) return { pretentious: 0, rewatch: 0, quality: 0, popularity: 0 };
  const scores = movies.map(m => (m.vote_average || 0));
  const pops = movies.map(m => (m.popularity || 0));
  const minPop = Math.min(...pops);
  const maxPop = Math.max(...pops);
  const normPops = pops.map(p => (maxPop === minPop ? 0.5 : (p - minPop)/(maxPop-minPop)));
  const normScores = scores.map(s => Math.min(1, Math.max(0, s/10)));
  const quality = scores.reduce((a,b)=>a+b,0)/scores.length;
  const popularity = pops.reduce((a,b)=>a+b,0)/pops.length;
  const pretArr = normScores.map((ns,idx)=>ns*(1-normPops[idx]));
  const pretentious = (pretArr.reduce((a,b)=>a+b,0)/pretArr.length)*100;
  const rewatchArr = normScores.map((ns,idx)=>ns*normPops[idx]);
  const rewatch = (rewatchArr.reduce((a,b)=>a+b,0)/rewatchArr.length)*100;
  return { pretentious: Math.round(pretentious), rewatch: Math.round(rewatch), quality: +(quality.toFixed(2)), popularity: +(popularity.toFixed(2)) };
}

/* distribute attack points like EditStack */
function distributeAttackPoints(totalPoints, moviesArr) {
  const movies = (moviesArr || []).filter(Boolean);
  if (movies.length===0) return [];
  const scores = movies.map(m => (m.vote_average||0));
  const sumScores = scores.reduce((a,b)=>a+b,0);
  if(sumScores===0){
    const base = Math.floor(totalPoints/movies.length);
    const remainder = totalPoints - base*movies.length;
    return movies.map((m,idx)=>base + (idx<remainder?1:0));
  }
  const rawAlloc = scores.map(s=>(s/sumScores)*totalPoints);
  const floored = rawAlloc.map(v=>Math.floor(v));
  let remainder = totalPoints - floored.reduce((a,b)=>a+b,0);
  const fractions = rawAlloc.map((v,idx)=>({idx, frac:v-Math.floor(v)}));
  fractions.sort((a,b)=>b.frac-a.frac);
  const final = [...floored];
  for(let i=0;i<remainder;i++){ final[fractions[i].idx]+=1; }
  return final;
}

export default function DuelPlay() {
  const { challenger: challengerSlug, opponent: opponentSlug } = useParams();
  const navigate = useNavigate();

  const [loading,setLoading] = useState(true);
  const [challenger,setChallenger] = useState(null);
  const [opponent,setOpponent] = useState(null);
  const [error,setError] = useState(null);

  const [revealIndex,setRevealIndex] = useState(-1);
  const [showGoMessage,setShowGoMessage] = useState(false);
  const [showCalc,setShowCalc] = useState(false);
  const [calcValue,setCalcValue] = useState(0);
  const [showLoseModal,setShowLoseModal] = useState(false);
  const [profileModalVisible,setProfileModalVisible] = useState(true); // side profile

  const slotAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const readyGoRef = useRef(null);
  const wooshRef = useRef(null);
  const moveRef = useRef(null);
  const damageRef = useRef(null);
  const numbersRef = useRef(null);
  const loseRef = useRef(null);

  const mountedRef = useRef(true);
  const bgStartedRef = useRef(false);
  const rootRef = useRef(null);

  useEffect(()=>{
    mountedRef.current=true;

    async function init(){
      setLoading(true); setError(null);
      try{
        const [c,o] = await Promise.all([
          fetchProfileBySlug(challengerSlug),
          fetchProfileBySlug(opponentSlug)
        ]);
        if(!mountedRef.current) return;
        if(!c||!o){ setError("Could not load one or both profiles."); setLoading(false); return; }

        c.wins = Number.isFinite(c.wins)?c.wins:0;
        c.losses = Number.isFinite(c.losses)?c.losses:0;
        c.draws = Number.isFinite(c.draws)?c.draws:0;
        c.level = Number.isFinite(c.level)?c.level:1;
        c.deck = Array.isArray(c.deck)?c.deck:[];
        o.wins = Number.isFinite(o.wins)?o.wins:0;
        o.losses = Number.isFinite(o.losses)?o.losses:0;
        o.draws = Number.isFinite(o.draws)?o.draws:0;
        o.level = Number.isFinite(o.level)?o.level:1;
        o.deck = Array.isArray(o.deck)?o.deck:[];

        setChallenger(c); setOpponent(o);

        // Hide profile modal immediately on duel start
        setProfileModalVisible(false);

        // silent unlock
        try{
          if(SILENT_AUDIO){const s=new Audio(SILENT_AUDIO); s.volume=0; s.play().catch(()=>{}); silentAudioRef.current=s;}
        }catch(e){}

        slotAudioRef.current=new Audio(SLOT_AUDIO); slotAudioRef.current.preload="auto";

        const lastIdxRaw = localStorage.getItem("leaderbox_last_song_idx");
        let idx = 0;
        try{
          const last = Number.isFinite(+lastIdxRaw)?Number(lastIdxRaw):-1;
          idx=(last+1)%BACKGROUND_SONGS.length;
        }catch(e){ idx=Math.floor(Math.random()*BACKGROUND_SONGS.length);}
        localStorage.setItem("leaderbox_last_song_idx",String(idx));

        const bg = new Audio(BACKGROUND_SONGS[idx]);
        bg.loop=true; bg.volume=0.14; bg.preload="auto"; bgAudioRef.current=bg;

        // preload other audios
        readyGoRef.current=new Audio(READYGO_AUDIO);
        wooshRef.current=new Audio(WOOSH_AUDIO);
        moveRef.current=new Audio(MOVE_AUDIO);
        damageRef.current=new Audio(DAMAGE_AUDIO);
        numbersRef.current=new Audio(NUMBERS_AUDIO);
        loseRef.current=new Audio(LOSE_AUDIO);

        // start reveal sequence shortly after render
        setTimeout(()=>startRevealSequence(c,o),400);

      }catch(err){ console.error("duel play init error",err); if(mountedRef.current) setError(String(err)); }
      finally{ if(mountedRef.current) setLoading(false); }
    }

    function startRevealSequence(c,o){
      const topCount = Math.max(4,(o&&o.deck?o.deck.length:0));
      const bottomCount = Math.max(4,(c&&c.deck?c.deck.length:0));
      const total = topCount+bottomCount;
      let step=0;

      const revealTick = async ()=>{
        if(!mountedRef.current) return;
        setRevealIndex(step);
        try{
          if(slotAudioRef.current){
            const a=slotAudioRef.current.cloneNode(true); a.volume=0.9; a.play().catch(()=>{});
          }
        }catch(e){}
        step++;
        if(step<total){ setTimeout(revealTick,500);}
        else{
          // Play READYGO sound and show GO message
          if(readyGoRef.current){ readyGoRef.current.play().catch(()=>{});}
          setShowGoMessage(true);
          setTimeout(()=>setShowGoMessage(false),1000);

          // Start opponent attack animation sequence
          setTimeout(()=>opponentAttackAnimation(c,o),500);
        }
      };
      revealTick();
    }

    async function opponentAttackAnimation(c,o){
      if(!mountedRef.current) return;

      const topCount = Math.max(4,(o&&o.deck?o.deck.length:0));
      const bottomCount = Math.max(4,(c&&c.deck?c.deck.length:0));

      // STEP 1: Posters pop-out with WOOSH
      if(wooshRef.current){ wooshRef.current.play().catch(()=>{}); }
      document.querySelectorAll(".from-top .slot-poster-wrap").forEach(el=>{
        el.style.transform="scale(1.12)";
        el.style.transition="transform 200ms";
      });
      await new Promise(r=>setTimeout(r,200));

      // STEP 2: Posters back to normal
      document.querySelectorAll(".from-top .slot-poster-wrap").forEach(el=>{
        el.style.transform="scale(1)";
      });

      // STEP 3: Move down to bottom slots with MOVE
      if(moveRef.current){ moveRef.current.play().catch(()=>{});}
      const topPosters=document.querySelectorAll(".from-top .slot-poster-wrap");
      const bottomPosters=document.querySelectorAll(".from-bottom .slot-poster-wrap");

      topPosters.forEach((el,idx)=>{
        const target=bottomPosters[idx];
        if(target){
          const rectTarget=target.getBoundingClientRect();
          const rectEl=el.getBoundingClientRect();
          const deltaY=rectTarget.top-rectEl.top;
          el.style.transition="transform 600ms ease";
          el.style.transform=`translateY(${deltaY}px)`;
        }
      });

      await new Promise(r=>setTimeout(r,600));

      // STEP 4: Damage overlay
      if(damageRef.current){ damageRef.current.play().catch(()=>{});}
      bottomPosters.forEach(el=>{
        el.style.filter="brightness(1.2) saturate(0.4) sepia(0.8) hue-rotate(-10deg)";
      });
      await new Promise(r=>setTimeout(r,1000));
      bottomPosters.forEach(el=>{ el.style.filter=""; });

      // STEP 5: Return top posters to original positions with WOOSH
      if(wooshRef.current){ wooshRef.current.play().catch(()=>{});}
      topPosters.forEach(el=>{
        el.style.transform="scale(1)";
      });

      // STEP 6: Compute calculation
      const challengerPoints=computeMoviePointsFromDeck(c.deck||[]);
      const opponentPoints=computeMoviePointsFromDeck(o.deck||[]);
      const diff=opponentPoints.total-challengerPoints.total;

      if(diff>0){
        // animate numbers
        setShowCalc(true); setCalcValue(challengerPoints.total);
        if(numbersRef.current){ numbersRef.current.play().catch(()=>{});}
        let val=challengerPoints.total;
        const stepTime=2000/diff;
        const interval=setInterval(()=>{
          val--; setCalcValue(val);
          if(val<=0){ clearInterval(interval); setShowCalc(false); 
            // Show lose modal
            setShowLoseModal(true);
            if(loseRef.current){ loseRef.current.play().catch(()=>{});}
            setTimeout(()=>{
              setShowLoseModal(false);
              // Update wins/losses
              c.losses++; o.wins++;
            },2000);
          }
        },stepTime);
      }
    }

    function computeMoviePointsFromDeck(deckArr){
      const stats=computeStats(deckArr);
      const moviePointsRaw=stats.pretentious + stats.rewatch + stats.quality + stats.popularity;
      const moviePoints=Math.round(moviePointsRaw);
      const perMovie=distributeAttackPoints(moviePoints,deckArr);
      return { total: moviePoints, perMovie, stats };
    }

    function topVisible(i,topCount=4){ if(revealIndex<0) return false; return revealIndex>=i; }
    function bottomVisible(i,topCount=4){ if(revealIndex<0) return false; return revealIndex>=(topCount+i); }

    function handleBeginClick(){
      // trigger transform/scale for mobile
      const root=rootRef.current||document.querySelector(".duel-play-root");
      if(!root){ return; }
      setProfileModalVisible(false); // hide side profile
    }

    init();

    return ()=>{ mountedRef.current=false; };
  },[challengerSlug,opponentSlug]);

  if(loading) return <div style={{padding:24}}><h2 className="h1-retro">Loading duel…</h2></div>;
  if(error) return <div style={{padding:24}}><h2 className="h1-retro">Duel error</h2><div style={{color:"#f66",marginTop:8}}>{String(error)}</div><div style={{marginTop:12}}><button className="ms-btn" onClick={()=>navigate(-1)}>Go back</button></div></div>;
  if(!challenger||!opponent) return <div style={{padding:24}}><h2 className="h1-retro">Missing duel participants</h2></div>;

  const challengerPoints=computeMoviePointsFromDeck(challenger.deck||[]);
  const topCount=Math.max(4,(opponent&&opponent.deck?opponent.deck.length:0));
  const bottomCount=Math.max(4,(challenger&&challenger.deck?challenger.deck.length:0));

  return (
    <div ref={rootRef} className="duel-play-root" style={{padding:24,display:"flex",justifyContent:"center",position:"relative"}}>
      {profileModalVisible && <div className="profile-modal" style={{position:"absolute",right:0,top:100,width:240,height:300,background:"#222",zIndex:90}}>Profile info</div>}
      <div className="center-stage" style={{width:"100%",maxWidth:"720px",display:"flex",flexDirection:"column",alignItems:"center",margin:"0 auto"}}>
        <div className="bar-block" aria-hidden />
        <div className="bar-overlay" style={{alignItems:"stretch",width:"100%"}}>
          {/* Opponent top row */}
          <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"center",marginTop:6}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:72,height:72,overflow:"hidden",borderRadius:10}}>
                {opponent.avatar?(<img src={opponent.avatar} alt={opponent.nickname} style={{width:"100%",height:"100%",objectFit:"cover"}}/>)
                :(<div style={{width:72,height:72,background:"#111",display:"flex",alignItems:"center",justifyContent:"center",color:"#ddd"}}>{(opponent.nickname||"U").slice(0,1)}</div>)}
              </div>
              <div style={{textAlign:"left"}}><div style={{fontWeight:900,color:"var(--accent)",fontSize:18}}>{opponent.nickname}</div><div className="small" style={{color:"#ddd"}}>Level {opponent.level}</div></div>
            </div>
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:8,overflowX:"auto"}}>
            {Array.from({length:4}).map((_,i)=>{
              const m=(opponent.deck&&opponent.deck[i])?opponent.deck[i]:null;
              const poster=posterFor(m);
              const visible=topVisible(i,topCount);
              return <div key={`opp-slot-${i}`} className={`duel-slot ${visible?"visible from-top":"hidden from-top"}`} style={{width:110,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <div className="slot-poster-wrap" style={{width:92,height:136,borderRadius:8,overflow:"hidden",background:"#0d0d10",boxShadow:visible?"0 4px 14px rgba(0,0,0,0.5)":"none",transition:"all 400ms"}}>
                  {poster&&visible&&<img src={poster} alt={m?.title||m?.name} style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                </div>
              </div>;
            })}
          </div>
          {/* Challenger bottom row */}
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:24,overflowX:"auto"}}>
            {Array.from({length:4}).map((_,i)=>{
              const m=(challenger.deck&&challenger.deck[i])?challenger.deck[i]:null;
              const poster=posterFor(m);
              const visible=bottomVisible(i,topCount);
              return <div key={`chall-slot-${i}`} className={`duel-slot ${visible?"visible from-bottom":"hidden from-bottom"}`} style={{width:110,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <div className="slot-poster-wrap" style={{width:92,height:136,borderRadius:8,overflow:"hidden",background:"#0d0d10",boxShadow:visible?"0 4px 14px rgba(0,0,0,0.5)":"none",transition:"all 400ms"}}>
                  {poster&&visible&&<img src={poster} alt={m?.title||m?.name} style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                </div>
              </div>;
            })}
          </div>
        </div>
        {showGoMessage && <div className="ready-go-msg" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:48,fontWeight:900,color:"#FDEE69",textShadow:"0 0 14px #FFF"}}>GO!</div>}
        {showCalc && <div className="calc-animation" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:36,color:"#DE5022",fontWeight:900}}>{calcValue}</div>}
        {showLoseModal && <div className="lose-modal" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}><img src={LOSE_GIF} alt="Lose" style={{width:240,height:240}} /></div>}
      </div>
      <button className="ms-btn" style={{position:"absolute",bottom:12,right:12}} onClick={()=>navigate(-1)}>Back</button>
    </div>
  );
}
