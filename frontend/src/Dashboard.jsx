import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import he from 'he';

export default function Dashboard() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [playlistTracks, setPlaylistTracks] = useState([]);
    const [loadingTracks, setLoadingTracks] = useState(false);

    // NEW RAG STATE VARIABLES - ADD THESE
    const [processing, setProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [processedPlaylists, setProcessedPlaylists] = useState([]);
    const [weaviateStatus, setWeaviateStatus] = useState('unknown');

    // Token refresh function
    const refreshAccessToken = useCallback(async () => {
        const refreshToken = localStorage.getItem('spotifyRefreshToken');
        
        if (!refreshToken) {
            console.log('No refresh token available');
            return null;
        }

        try {
            console.log('Attempting to refresh token...');
            const response = await axios.post('http://127.0.0.1:8000/api/spotify/refresh', {
                refresh_token: refreshToken
            });

            const newAccessToken = response.data.access_token || response.data.accessToken;
            if (newAccessToken) {
                localStorage.setItem('spotifyAccessToken', newAccessToken);
                console.log('Token refreshed successfully');
                return newAccessToken;
            }
        } catch (error) {
            console.error('Token refresh failed:', error.response?.data || error.message);
            localStorage.removeItem('spotifyAccessToken');
            localStorage.removeItem('spotifyRefreshToken');
            return null;
        }
    }, []);

    // Enhanced API call with automatic token refresh
    const makeSpotifyRequest = useCallback(async (url, options = {}) => {
        let token = localStorage.getItem('spotifyAccessToken');
        
        const makeRequest = async (currentToken) => {
            return axios.get(url, {
                ...options,
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                    ...options.headers
                }
            });
        };

        try {
            return await makeRequest(token);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('Token expired, attempting refresh...');
                const newToken = await refreshAccessToken();
                
                if (newToken) {
                    return await makeRequest(newToken);
                } else {
                    throw new Error('Session expired. Please log in again.');
                }
            }
            throw error;
        }
    }, [refreshAccessToken]);

    // NEW RAG FUNCTIONS - ADD THESE

    // Initialize Weaviate on component mount
    useEffect(() => {
        const initializeWeaviate = async () => {
            try {
                console.log('🔧 Initializing Weaviate...');
                setWeaviateStatus('initializing');
                
                // Check Weaviate health
                const healthResponse = await axios.get('http://127.0.0.1:8000/api/weaviate/health');
                console.log('Weaviate health:', healthResponse.data);
                
                // Initialize schema
                const initResponse = await axios.post('http://127.0.0.1:8000/api/weaviate/init');
                console.log('Weaviate schema initialized:', initResponse.data);
                
                setWeaviateStatus('ready');
            } catch (error) {
                console.error('Failed to initialize Weaviate:', error);
                setWeaviateStatus('error');
            }
        };
        
        initializeWeaviate();
    }, []);

    // Process playlist with RAG
    const processPlaylistWithRAG = async (playlist) => {
        if (processing) return;
        
        setProcessing(true);
        try {
            console.log(`🎯 Processing playlist "${playlist.name}" with RAG...`);
            
            // First fetch all tracks if not already fetched
            let tracks = playlistTracks;
            if (selectedPlaylist?.id !== playlist.id) {
                await fetchPlaylistTracks(playlist.id, playlist.name);
                tracks = playlistTracks; // This will be updated by fetchPlaylistTracks
            }
            
            // Send to RAG processing
            const token = localStorage.getItem('spotifyAccessToken');
            const response = await axios.post(
                'http://127.0.0.1:8000/api/playlist/process',
                {
                    playlistId: playlist.id,
                    tracks: tracks.length > 0 ? tracks : playlistTracks,
                    playlistName: playlist.name
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 120000 // 2 minute timeout for large playlists
                }
            );
            
            console.log('✅ Playlist processed:', response.data);
            setProcessedPlaylists(prev => [...prev, playlist.id]);
            
            alert(`🎉 Successfully processed "${playlist.name}"!\n` +
                  `${response.data.processedSongs}/${response.data.totalTracks} songs indexed for AI search.`);
                  
        } catch (error) {
            console.error('❌ Error processing playlist:', error);
            
            if (error.code === 'ECONNABORTED') {
                alert('Processing timed out. Large playlists may take longer. Please try again.');
            } else {
                alert(`Failed to process "${playlist.name}". Please try again.\n\nError: ${error.response?.data?.error || error.message}`);
            }
        } finally {
            setProcessing(false);
        }
    };

    // Search songs using RAG
    const searchSongs = async () => {
        if (!searchQuery.trim() || searching) return;
        
        setSearching(true);
        try {
            console.log(`🔍 Searching for: "${searchQuery}"`);
            
            const response = await axios.post('http://127.0.0.1:8000/api/songs/search', {
                query: searchQuery,
                limit: 20
            });
            
            setSearchResults(response.data.results);
            console.log(`Found ${response.data.results.length} results`);
            
        } catch (error) {
            console.error('Search failed:', error);
            setError('Search failed. Make sure you have processed some playlists first.');
            setTimeout(() => setError(null), 3000);
        } finally {
            setSearching(false);
        }
    };

    // Generate smart playlist
    const generateSmartPlaylist = async (theme, mood) => {
        try {
            setSearching(true);
            console.log(`🎨 Generating ${theme} ${mood} playlist...`);
            
            const response = await axios.post('http://127.0.0.1:8000/api/playlist/generate', {
                theme,
                mood,
                limit: 20
            });
            
            setSearchResults(response.data.playlist.songs);
            setSearchQuery(`${theme} ${mood} mix`);
            console.log('Generated playlist:', response.data.playlist);
            
        } catch (error) {
            console.error('Failed to generate playlist:', error);
            setError('Failed to generate smart playlist. Process some playlists first.');
            setTimeout(() => setError(null), 3000);
        } finally {
            setSearching(false);
        }
    };

    // Fetch playlist tracks (for RAG processing preparation)
    const fetchPlaylistTracks = async (playlistId, playlistName) => {
        setLoadingTracks(true);
        try {
            console.log(`Fetching tracks for playlist: ${playlistName}`);
            
            let allTracks = [];
            let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
            
            while (nextUrl) {
                const response = await makeSpotifyRequest(nextUrl);
                allTracks = [...allTracks, ...response.data.items];
                nextUrl = response.data.next;
            }

            console.log(`Fetched ${allTracks.length} tracks from ${playlistName}`);
            setPlaylistTracks(allTracks);
            setSelectedPlaylist({ id: playlistId, name: playlistName });
            
        } catch (error) {
            console.error('Error fetching playlist tracks:', error.message);
            setError(`Failed to load tracks for ${playlistName}`);
        } finally {
            setLoadingTracks(false);
        }
    };

    // Main data fetching function
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('spotifyAccessToken');
            console.log('Access Token:', token ? 'EXISTS' : 'NOT FOUND');

            if (!token) {
                console.log('No token found, redirecting to home');
                navigate('/');
                return;
            }

            console.log('Fetching user data...');
            const userResponse = await makeSpotifyRequest('https://api.spotify.com/v1/me');
            console.log('User data fetched successfully:', userResponse.data.display_name);
            setUserData(userResponse.data);

            console.log('Fetching playlists...');
            let allPlaylists = [];
            let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
            
            while (nextUrl && allPlaylists.length < 200) {
                const playlistsResponse = await makeSpotifyRequest(nextUrl);
                allPlaylists = [...allPlaylists, ...playlistsResponse.data.items];
                nextUrl = playlistsResponse.data.next;
            }
            
            console.log('Playlists fetched:', allPlaylists.length);
            setPlaylists(allPlaylists);

        } catch (error) {
            console.error('Error fetching user data:', error.message);
            
            if (error.message.includes('Session expired')) {
                setError(error.message);
                setTimeout(() => navigate('/'), 2000);
            } else {
                setError('Failed to load your Spotify data. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [navigate, makeSpotifyRequest]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // REPLACE YOUR preparePlaylistForProcessing FUNCTION WITH THIS:
    const preparePlaylistForProcessing = async (playlist) => {
        await processPlaylistWithRAG(playlist);
    };

    // Loading state (keep your existing loading component)
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#1a1a1a',
                color: 'white'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    padding: '40px 60px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }}>
                    <div style={{
                        position: 'relative',
                        width: '60px',
                        height: '60px',
                        marginBottom: '24px'
                    }}>
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            border: '3px solid rgba(29, 185, 84, 0.2)',
                            borderRadius: '50%'
                        }}></div>
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            border: '3px solid transparent',
                            borderTop: '3px solid #1db954',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                    </div>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        margin: '0 0 8px 0',
                        background: 'linear-gradient(45deg, #1db954, #1ed760)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'glow 2s ease-in-out infinite alternate'
                    }}>
                        Loading your music
                    </h2>
                    <p style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        margin: '0'
                    }}>
                        Fetching your Spotify data...
                    </p>
                </div>
            </div>
        );
    }

    // Error state (keep your existing error component)
    if (error) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#1a1a1a',
                color: '#ff6b6b'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h2>Error</h2>
                    <p>{error}</p>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button 
                            onClick={() => fetchData()}
                            style={{
                                background: '#1db954',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            Retry
                        </button>
                        <button 
                            onClick={() => navigate('/')}
                            style={{
                                background: '#666',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main dashboard
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to bottom, #1a1a1a, #2a2a2a)',
            color: 'white',
            padding: '32px'
        }}>
            {/* Header */}
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px' }}>
                    Resonance Dashboard
                </h1>
                
                {/* NEW: Weaviate Status Indicator */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: weaviateStatus === 'ready' ? '#28a745' : 
                                   weaviateStatus === 'error' ? '#dc3545' : '#ffc107',
                        color: weaviateStatus === 'initializing' ? '#000' : '#fff'
                    }}>
                        🤖 AI: {weaviateStatus === 'ready' ? 'READY' : 
                               weaviateStatus === 'error' ? 'ERROR' : 'LOADING...'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#bbb' }}>
                        {processedPlaylists.length} playlists processed
                    </div>
                </div>

                {userData && (
                    <div style={{
                        background: '#333',
                        padding: '16px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        {userData.images && userData.images[0] && (
                            <img 
                                src={userData.images[0].url} 
                                alt="Profile" 
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%'
                                }}
                            />
                        )}
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                Welcome, {userData.display_name}!
                            </h2>
                            <p style={{ color: '#bbb' }}>
                                {userData.followers?.total} followers • {userData.country}
                            </p>
                        </div>
                    </div>
                )}
            </header>

            {/* NEW: RAG Search Section - ADD THIS BEFORE PLAYLISTS */}
            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px' }}>
                    🎯 AI-Powered Music Search
                </h2>
                
                {/* Search Bar */}
                <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginBottom: '16px',
                    alignItems: 'center'
                }}>
                    <input
                        type="text"
                        placeholder="Search for songs by mood, genre, energy, or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchSongs()}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #666',
                            background: '#333',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                    />
                    <button
                        onClick={searchSongs}
                        disabled={searching || !searchQuery.trim()}
                        style={{
                            background: searching ? '#666' : '#1db954',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            cursor: searching ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold'
                        }}
                    >
                        {searching ? 'Searching...' : '🔍 Search'}
                    </button>
                </div>
                
                {/* Quick Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {[
                        { theme: 'energetic', mood: 'upbeat' },
                        { theme: 'relaxing', mood: 'calm' },
                        { theme: 'romantic', mood: 'love' },
                        { theme: 'workout', mood: 'intense' },
                        { theme: 'study', mood: 'focus' },
                        { theme: 'party', mood: 'dance' }
                    ].map(({ theme, mood }) => (
                        <button
                            key={`${theme}-${mood}`}
                            onClick={() => generateSmartPlaylist(theme, mood)}
                            disabled={weaviateStatus !== 'ready'}
                            style={{
                                background: '#444',
                                color: 'white',
                                border: '1px solid #666',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                cursor: weaviateStatus !== 'ready' ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                                transition: 'all 0.2s',
                                opacity: weaviateStatus !== 'ready' ? 0.5 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (weaviateStatus === 'ready') {
                                    e.currentTarget.style.background = '#1db954';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#444';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            {theme} {mood}
                        </button>
                    ))}
                </div>
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div style={{ 
                        background: '#333', 
                        borderRadius: '8px', 
                        padding: '16px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                    }}>
                        <h3 style={{ marginBottom: '12px', color: '#1db954' }}>
                            🎵 Found {searchResults.length} songs
                        </h3>
                        {searchResults.map((song, index) => (
                            <div key={index} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                borderBottom: index < searchResults.length - 1 ? '1px solid #444' : 'none',
                                borderRadius: '4px',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#404040'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                                        {song.title}
                                    </div>
                                    <div style={{ color: '#bbb', fontSize: '0.875rem' }}>
                                        {song.artist} • {song.album}
                                    </div>
                                    {song.audioFeatures && (
                                        <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '4px' }}>
                                            Energy: {(song.audioFeatures.energy * 100).toFixed(0)}% • 
                                            Danceability: {(song.audioFeatures.danceability * 100).toFixed(0)}% • 
                                            Valence: {(song.audioFeatures.valence * 100).toFixed(0)}%
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => window.open(`https://open.spotify.com/track/${song.spotifyId}`, '_blank')}
                                    style={{
                                        background: '#1db954',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    🎵 Play
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Playlist Section - KEEP YOUR EXISTING CODE BUT UPDATE THE BUTTON */}
            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Your Playlists ({playlists.length})
                    </h2>
                    {selectedPlaylist && (
                        <div style={{ 
                            background: '#1db954', 
                            padding: '8px 16px', 
                            borderRadius: '20px',
                            fontSize: '0.875rem'
                        }}>
                            Selected: {selectedPlaylist.name}
                        </div>
                    )}
                </div>

                {playlists.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '16px'
                    }}>
                        {playlists.map(playlist => (
                            <div 
                                key={playlist.id} 
                                style={{
                                    background: selectedPlaylist?.id === playlist.id ? '#2a4a2a' : '#333',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer',
                                    border: selectedPlaylist?.id === playlist.id ? '2px solid #1db954' : '2px solid transparent'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedPlaylist?.id !== playlist.id) {
                                        e.currentTarget.style.transform = 'scale(1.02)';
                                        e.currentTarget.style.background = '#444';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    if (selectedPlaylist?.id !== playlist.id) {
                                        e.currentTarget.style.background = '#333';
                                    }
                                }}
                            >
                                {playlist.images && playlist.images[0] && (
                                    <img 
                                        src={playlist.images[0].url} 
                                        alt={playlist.name}
                                        style={{
                                            width: '100%',
                                            height: '200px',
                                            objectFit: 'cover',
                                            borderRadius: '4px',
                                            marginBottom: '12px'
                                        }}
                                    />
                                )}
                                <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                    {playlist.name}
                                </h3>
                                <p style={{ color: '#bbb', fontSize: '0.875rem', marginBottom: '12px' }}>
                                    {playlist.description ? he.decode(playlist.description) : 'No description available'}
                                </p>
                                <p style={{ color: '#1db954', fontSize: '0.75rem', marginBottom: '12px' }}>
                                    {playlist.tracks.total} tracks • By {playlist.owner.display_name}
                                </p>
                                
                                {/* UPDATED Action Buttons */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            processPlaylistWithRAG(playlist);
                                        }}
                                        disabled={processing || weaviateStatus !== 'ready'}
                                        style={{
                                            background: processing ? '#666' : 
                                                      processedPlaylists.includes(playlist.id) ? '#28a745' : 
                                                      weaviateStatus !== 'ready' ? '#666' : '#1db954',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            cursor: (processing || weaviateStatus !== 'ready') ? 'not-allowed' : 'pointer',
                                            fontSize: '0.75rem',
                                            opacity: (processing || weaviateStatus !== 'ready') ? 0.5 : 1
                                        }}
                                    >
                                        {processing ? '⏳ Processing...' : 
                                         processedPlaylists.includes(playlist.id) ? '✅ AI Processed' : 
                                         weaviateStatus !== 'ready' ? '⏳ AI Loading...' : '🤖 Process with AI'}
                                    </button>
                                    
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(playlist.external_urls.spotify, '_blank');
                                        }}
                                        style={{
                                            background: '#333',
                                            color: 'white',
                                            border: '1px solid #666',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        🎵 Open in Spotify
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: '#bbb' }}>No playlists found.</p>
                )}
            </section>

            {/* Keep your existing Selected Playlist Details section */}
            {selectedPlaylist && playlistTracks.length > 0 && (
                <section style={{ marginTop: '32px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>
                        📋 Tracks in "{selectedPlaylist.name}" ({playlistTracks.length} tracks)
                    </h3>
                    <div style={{ 
                        background: '#333', 
                        borderRadius: '8px', 
                        padding: '16px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {playlistTracks.slice(0, 10).map((item, index) => (
                            <div key={index} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                padding: '8px',
                                borderBottom: index < 9 ? '1px solid #444' : 'none'
                            }}>
                                {item.track?.album?.images?.[2] && (
                                    <img 
                                        src={item.track.album.images[2].url} 
                                        alt="Album"
                                        style={{ width: '40px', height: '40px', marginRight: '12px', borderRadius: '4px' }}
                                    />
                                )}
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                                        {item.track?.name || 'Unknown Track'}
                                    </div>
                                    <div style={{ color: '#bbb', fontSize: '0.75rem' }}>
                                        {item.track?.artists?.[0]?.name || 'Unknown Artist'} • {item.track?.album?.name || 'Unknown Album'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {playlistTracks.length > 10 && (
                            <div style={{ textAlign: 'center', padding: '8px', color: '#bbb', fontSize: '0.875rem' }}>
                                ... and {playlistTracks.length - 10} more tracks
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Footer */}
            <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                <button 
                    onClick={() => {
                        localStorage.removeItem('spotifyAccessToken');
                        localStorage.removeItem('spotifyRefreshToken');
                        navigate('/');
                    }}
                    style={{
                        background: '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    Logout
                </button>
                
                <button 
                    onClick={fetchData}
                    style={{
                        background: '#666',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    🔄 Refresh Data
                </button>
                
                {/* NEW: Debug/Status Button */}
                <button 
                    onClick={async () => {
                        try {
                            const health = await axios.get('http://127.0.0.1:8000/api/weaviate/health');
                            alert(`Weaviate Status: ${JSON.stringify(health.data, null, 2)}`);
                        } catch (error) {
                            alert(`Weaviate Error: ${error.message}`);
                        }
                    }}
                    style={{
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    🔍 Check AI Status
                </button>
            </div>
            
            {/* Add CSS animations */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes glow {
                    0% { filter: brightness(1) drop-shadow(0 0 5px rgba(29, 185, 84, 0.3)); }
                    100% { filter: brightness(1.2) drop-shadow(0 0 15px rgba(29, 185, 84, 0.5)); }
                }
            `}</style>
        </div>
    );
}