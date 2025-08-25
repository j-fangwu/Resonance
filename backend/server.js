const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

const weaviateClient = require('./weaviateClient');

app.use(cors({
    origin: 'http://127.0.0.1:3000',
    credentials: true
}));
app.use(express.json());

// Enhanced logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Environment variables validation
const requiredEnvVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please check your .env file');
} else {
    console.log('✅ All required environment variables are set');
}

// Spotify token exchange endpoint with extensive debugging
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.'
});

app.post('/api/spotify/auth', authLimiter, async (req, res) => {
    console.log('\n🎵 === SPOTIFY TOKEN EXCHANGE START ===');
    
    try {
        const { code } = req.body;
        
        if (!code) {
            console.log('❌ No authorization code provided');
            return res.status(400).json({ error: 'Authorization code is required' });
        }
        
        console.log('✅ Received auth code:', code.substring(0, 20) + '...');
        
        // Validate environment variables
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
        
        console.log('Environment check:');
        console.log('- Client ID:', clientId ? `${clientId.substring(0, 8)}...` : '❌ MISSING');
        console.log('- Client Secret:', clientSecret ? `${clientSecret.substring(0, 8)}...` : '❌ MISSING');
        console.log('- Redirect URI:', redirectUri || '❌ MISSING');
        
        if (!clientId || !clientSecret || !redirectUri) {
            console.log('❌ Missing required environment variables');
            return res.status(500).json({ 
                error: 'Server configuration error - missing environment variables' 
            });
        }
        
        // Prepare token exchange request
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', redirectUri);
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        
        console.log('📤 Making request to Spotify token endpoint...');
        console.log('Request params (without secrets):');
        console.log('- grant_type: authorization_code');
        console.log('- code:', code.substring(0, 20) + '...');
        console.log('- redirect_uri:', redirectUri);
        console.log('- client_id:', clientId.substring(0, 8) + '...');
        console.log('- client_secret: [HIDDEN]');
        
        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000, // 10 second timeout
        });
        
        console.log('✅ Spotify response received');
        console.log('Response status:', response.status);
        console.log('Response data keys:', Object.keys(response.data));
        
        if (response.data.access_token) {
            console.log('✅ Access token received successfully');
            console.log('Token preview:', response.data.access_token.substring(0, 20) + '...');
            console.log('Token type:', response.data.token_type);
            console.log('Expires in:', response.data.expires_in);
            console.log('Scope:', response.data.scope);
        }
        
        // Return both formats for compatibility
        const responseData = {
            access_token: response.data.access_token,
            accessToken: response.data.access_token,
            refresh_token: response.data.refresh_token,
            refreshToken: response.data.refresh_token,
            expires_in: response.data.expires_in,
            token_type: response.data.token_type,
            scope: response.data.scope
        };
        
        console.log('✅ Sending success response to client');
        res.json(responseData);
        
    } catch (error) {
        console.log('❌ ERROR during token exchange:');
        console.log('Error type:', error.constructor.name);
        console.log('Error message:', error.message);
        
        if (error.response) {
            console.log('Spotify API Error Response:');
            console.log('- Status:', error.response.status);
            console.log('- Status Text:', error.response.statusText);
            console.log('- Headers:', JSON.stringify(error.response.headers, null, 2));
            console.log('- Data:', JSON.stringify(error.response.data, null, 2));
            
            // Common error explanations
            if (error.response.status === 400) {
                const errorData = error.response.data;
                if (errorData.error === 'invalid_client') {
                    console.log('🔍 DIAGNOSIS: Invalid client credentials');
                    console.log('   - Check your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
                    console.log('   - Make sure they match your Spotify app settings');
                } else if (errorData.error === 'invalid_grant') {
                    console.log('🔍 DIAGNOSIS: Invalid authorization code');
                    console.log('   - The authorization code might be expired or already used');
                    console.log('   - Authorization codes expire after 10 minutes');
                    console.log('   - Each code can only be used once');
                } else if (errorData.error === 'redirect_uri_mismatch') {
                    console.log('🔍 DIAGNOSIS: Redirect URI mismatch');
                    console.log('   - Check that SPOTIFY_REDIRECT_URI matches your app settings exactly');
                    console.log('   - Current value:', process.env.SPOTIFY_REDIRECT_URI);
                }
            }
        } else if (error.code === 'ECONNABORTED') {
            console.log('🔍 DIAGNOSIS: Request timeout');
            console.log('   - The request to Spotify took too long');
            console.log('   - Check your internet connection');
        } else {
            console.log('Network or other error:', error.code || 'Unknown');
        }
        
        res.status(error.response?.status || 500).json({ 
            error: 'Authentication failed',
            details: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        console.log('🎵 === SPOTIFY TOKEN EXCHANGE END ===\n');
    }
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Allow more refresh attempts than auth (tokens expire every hour)
    message: 'Too many refresh requests, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.post('/api/spotify/refresh', refreshLimiter, async (req, res) => {
    console.log('🎵 === SPOTIFY TOKEN REFRESH START ===');

    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            console.log('❌ No refresh token provided');
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        console.log('✅ Received refresh token:', refresh_token.substring(0, 20) + '...');

        // Validate environment variables
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.log('❌ Missing required environment variables');
            return res.status(500).json({ error: 'Internal server error' }); 
        }

        // Prepare token refresh
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refresh_token);
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);

        console.log('📤 Making request to Spotify token endpoint for refresh...');

        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000,
        });

        console.log('✅ Token refresh successful');
        console.log('New token:', response.data.access_token?.substring(0, 20) + '...');

        const responseData = {
            access_token: response.data.access_token,
            accessToken: response.data.access_token,
            refresh_token: response.data.refresh_token || refresh_token, // Use new one if provided, else keep old
            refreshToken: response.data.refresh_token || refresh_token, 
            expires_in: response.data.expires_in,
            token_type: response.data.token_type,
            scope: response.data.scope
        };
        res.json(responseData);

    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ error: 'Failed to refresh token' });

        if (error.response) {
            console.error('Response data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
    } finally {
        console.log('🎵 === SPOTIFY TOKEN REFRESH END ===\n');
    }
});

// Weaviate schemas
app.post('/api/weaviate/init', async (req, res) => {
    try {
        console.log('Initializing Weaviate client...');
        await weaviateClient.initialize();
        console.log('Weaviate client initialized successfully.');
        res.status(200).json({ message: 'Weaviate client initialized successfully.' });
    } catch (error) {
        console.error('Error initializing Weaviate client:', error);
        res.status(500).json({ error: 'Failed to initialize Weaviate client' });
    }
});

// Process playlist and store in Weaviate
app.post('/api/playlist/process', async (req, res) => {
    try {
        const { playlistId, tracks, playlistName } = req.body;
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        if (!playlistId || !tracks || !playlistName) {
            return res.status(400).json({ error: 'Incomplete playlist data provided' });
        }

        console.log('Processing playlist...');

        const processedSongs = []

        for (let i = 0; i < tracks.length; i++) {
            const trackItem = tracks[i];
            const track = trackItem.track;

            if (!track || !track.id) continue;

            try {
                const audioFeaturesResponse = await axios.get(
                    `https://api.spotify.com/v1/audio-features/${track.id}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: 5000   
                    }
                );

                const songData = {
                    spotifyId: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    genre: track.album.genres || [],
                    audioFeatures: audioFeaturesResponse.data,
                    releaseDate: track.album.release_date,
                    popularity: track.popularity || 0,
                    lyrics: ''
                };

                const weaviateId = await weaviateClient.addSong(songData);
                processedSongs.push({ ...songData, weaviateId });

                console.log(`Processed song: ${songData.title} by ${songData.artist} - (Weaviate ID: ${weaviateId})`);
                
                if (i < tracks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
                }
            } catch (error) {
                console.error('Error fetching audio features:', error);
            }
        }

        const playlistData = {
            spotifyId: playlistId,
            name: playlistName,
            description: `Processed playlist with ${processedSongs.length} songs`,
            owner: 'user',
            tags: ['processed'],
            mood: 'mixed',
            songCount: processedSongs.length
        };

        const playlistWeaviateId = await weaviateClient.addPlaylist(playlistData);

        res.json({
            success: true,
            message: `Successfully processed ${processedSongs.length} songs`,
            playlistId: playlistWeaviateId,
            processedSongs: processedSongs.length,
            totalTracks: tracks.length
        });

        console.log('Playlist processed and stored successfully.');
    } catch (error) {
        console.error('Error processing playlist:', error);
        res.status(500).json({ error: 'Failed to process playlist' });
    }
});

app.post('/api/songs/search', async (req, res) => {
    try {
        const { query, limit = 10 } = req.body;
        console.log(`Searching for songs with query: ${query} and limit: ${limit}`);
        const results = await weaviateClient.semanticSearchSongs(query, limit);

        res.json({
            success: true,
            results,
            query,
            count: results.length
        });
    } catch (error) {
        console.error('Error searching songs:', error);
        res.status(500).json({ error: 'Failed to search songs' });
    }
});

app.post('/api/songs/advanced-search', async (req, res) => {
    try {
        const { query, filters = {}, limit = 10 } = req.body;

        console.log(`Advanced search for songs with query: ${query}, filters: ${JSON.stringify(filters)}, limit: ${limit}`);

        const songs = await weaviateClient.advancedSearchSongs(query, filters, limit);

        res.json({
            success: true,
            results: songs,
            query,
            filters,
            count: songs.length
        });
    } catch (error) {
        console.error('Error in advanced search:', error);
        res.status(500).json({ error: 'Failed to perform advanced search' });
    }
});

app.get('/api/songs/:id/similar', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 5 } = req.query;

        const similarSongs = await weaviateClient.getSimilarSongs(id, parseInt(limit));
        
        res.json({
            success: true,
            similarSongs,
            count: similarSongs.length
        });
    } catch (error) {
        console.error('Error fetching similar songs:', error);
        res.status(500).json({ error: 'Failed to fetch similar songs' });
    }
});

app.post('/api/playlist/generate', async (req, res) => {
    try {
        const { theme, mood, limit = 20 } = req.body;

        const searchQuery = `${theme} ${mood} music`;
        const songs = await weaviateClient.semanticSearchSongs(searchQuery, limit);

        const songTitles = songs.slice(0, 5).map(s => `${s.title} by ${s.artist}`);
        const description = await weaviateClient.generatePlaylistDescription(songTitles);

        res.json({
            success: true,
            description: {
                name: `${theme} ${mood} Mix`,
                description,
                songs,
                theme,
                mood
            }
        });
    } catch (error) {

        console.error('Error generating playlist description:', error);
        res.status(500).json({ error: 'Failed to generate playlist description' });
    }
});

app.get('/api/weaviate/health', async (req, res) => {
    try {
        const isReady = await weaviateClient.isReady();
        res.json({
            weaviate: isReady ? 'ready' : 'not ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error checking Weaviate health:', error);
        res.status(500).json({ error: 'Weaviate not available' });
    }
})

// Enhanced health check with environment info
app.get('/api/health', (req, res) => {
    const envCheck = {
        SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? 'SET' : 'MISSING',
        SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'MISSING',
        SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || 'MISSING',
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: PORT
    };
    
    res.json({ 
        status: 'Server is running!',
        timestamp: new Date().toISOString(),
        environment: envCheck
    });
});

// Test endpoint to verify environment setup
app.get('/api/debug/env', (req, res) => {
    res.json({
        clientIdSet: !!process.env.SPOTIFY_CLIENT_ID,
        clientSecretSet: !!process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        allEnvVarsPresent: requiredEnvVars.every(varName => process.env[varName])
    });
});

// Test endpoint for token validation
app.get('/api/test/token', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000
        });
        
        res.json({ 
            valid: true, 
            user: response.data.display_name,
            userId: response.data.id
        });
    } catch (error) {
        console.log('Token validation failed:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            valid: false,
            error: error.response?.data || error.message
        });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🚀 Server running on http://127.0.0.1:${PORT}`);
    console.log('📊 Environment Status:');
    console.log('='.repeat(50));
    requiredEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${varName.includes('SECRET') ? '[HIDDEN]' : value}`);
        } else {
            console.log(`❌ ${varName}: NOT SET`);
        }
    });
    console.log('='.repeat(50));
    console.log('\n📋 Available endpoints:');
    console.log('- GET  /api/health       - Server status');
    console.log('- GET  /api/debug/env    - Environment check');
    console.log('- POST /api/spotify/auth - Token exchange');
    console.log('- GET  /api/test/token   - Token validation');
    console.log('- POST /api/spotify/refresh - Token refresh');
    console.log('\n🔍 Ready for debugging!\n');
});