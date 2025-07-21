import React from 'react';
import { motion } from 'framer-motion';

function SpotifyLogin() {
    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="connect-button"
            onClick ={() => {
                const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
                const redirectUri = import.meta.env.SPOTIFY_REDIRECT_URI;
                const scope = 'user-read-private user-read-email';
                const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId
                }&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`;
                window.location.href = authUrl;
            }}>

            <div className ="relative w-[180px] h-[180px]">
                <span className = "sr-only">Login with Spotify</span>
            </div>
        </motion.button>
    )
}

export default SpotifyLogin;