// src/components/LoginButton.jsx
import React from "react";

const LoginButton = () => {
  const CLIENT_KEY = import.meta.env.VITE_TIKTOK_CLIENT_KEY;
  const REDIRECT_URI = import.meta.env.VITE_TIKTOK_REDIRECT_URI;

  const loginUrl = `https://www.tiktok.com/auth/authorize?${new URLSearchParams({
    client_key: CLIENT_KEY,
    scope: "user.info.basic",
    response_type: "code",
    redirect_uri: REDIRECT_URI
  }).toString()}`;

  return (
    <a href={loginUrl}>
      Login with TikTok
    </a>
  );
};

export default Login;
