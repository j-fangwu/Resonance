// SpotifyLogin.jsx
import React from 'react';

const SpotifyLogin = () => {
  const handleLogin = () => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
    const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read'
    ];

    const authUrl = `https://accounts.spotify.com/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `show_dialog=true`;

    window.location.href = authUrl;
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <button
        onClick={handleLogin}
        style={{
          background: '#1db954',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '50px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background-color 0.3s'
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = '#1ed760'}
        onMouseLeave={(e) => e.target.style.backgroundColor = '#1db954'}
      >
        Login with Spotify
      </button>
    </div>
  );
};

export default SpotifyLogin;