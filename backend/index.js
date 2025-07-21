const express = require('express');
const cors = require('cors');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const app = express();
app.use(cors());

// Spotify OAuth Routes
app.get('/auth/spotify', (req, res) => {
    const scopes = ['playlist-read-private', 'playlist-modify-public', 'playlist-modify-private', 'playlist-read-collaborative'];
    const authUrl = new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    }).createAuthorizeURL(scopes);
    res.redirect(authUrl);
});

app.get('/', (req, res) => {
    res.send('Welcome to Resonance');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});