import React, { useEffect , useState } from 'react';
import { Routes , Route , useNavigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import Landing from "./components/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Duel from "./pages/Duel";
import Rules from "./pages/Rules";
import ProfilePage from "./pages/ProfilePage";
import ProfileModal from "./components/ProfileModal";

export default function App() {
  const [user , setUser] = useState(null);
  const [modalOpen , setModalOpen] = useState(false);
  const nav = useNavigate();

  useEffect(()=>{ //here i´ll try and fetch the profile if the token is present
   const token = localStorage.getItem("md_token");
   if(!token) return;

   // direct fetch instead of api(...) helper
   fetch("/api/profile", {
     headers: {
       Authorization: `Bearer ${token}`,
       "Content-Type": "application/json"
     },
     credentials: "include"
   })
     .then(res => {
       if (!res.ok) throw new Error("Not authenticated");
       return res.json();
     })
     .then(u => setUser(u.user))
     .catch(_=>{ localStorage.removeItem("md_token"); });
  }, []);

  function handleLogin(userObj, token){
    setUser(userObj);
    // store the token value so profile/api calls work
    localStorage.setItem("md_token", token);
  }

  function handleLogout(){
    setUser(null);
    localStorage.removeItem("md_token");
    nav("/");
  }

  return (
    <>
      <NavBar user={user} onOpenProfile={()=> setModalOpen(true)} />
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing/>} />
          <Route path="/signup" element={
            <Signup onSigned={(u,t)=>handleLogin(u,t)} />
          } />
          <Route path="/login" element={
            <Login onLogin={(u,t)=>handleLogin(u,t)} />
          } />
          <Route path="/duel" element={<Duel/>} />
          <Route path="/rules" element={<Rules/>} />
          <Route path="/profile" element={<ProfilePage user={user}/>} />
        </Routes>
      </div>

      <ProfileModal //this will the the profile modal set up on the side of the page
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        onUpdateUser={(u)=>setUser(u)}
      />

       <footer style={{
    marginTop: "60px",
    padding: "20px",
    textAlign: "center",
    color: "#888",
    fontSize: "14px"
  }}>
    <br />
      <a href="/privacy.html" target="_blank" style={{ color: "#66aaff" }}>
        Privacy Policy
      </a>{" "}
      •{" "}
      <a href="/terms.html" target="_blank" style={{ color: "#66aaff" }}>
        Terms of Service
      </a>
  </footer>
    </>
  );
}
