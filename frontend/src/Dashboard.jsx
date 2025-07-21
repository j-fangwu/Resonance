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
            // If refresh fails, clear tokens and redirect to login
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
            // Try with current token
            return await makeRequest(token);
        } catch (error) {
            // If 401, try to refresh token and retry
            if (error.response?.status === 401) {
                console.log('Token expired, attempting refresh...');
                const newToken = await refreshAccessToken();
                
                if (newToken) {
                    // Retry with new token
                    return await makeRequest(newToken);
                } else {
                    // Refresh failed, redirect to login
                    throw new Error('Session expired. Please log in again.');
                }
            }
            throw error;
        }
    }, [refreshAccessToken]);

    // Fetch playlist tracks (for RAG processing preparation)
    const fetchPlaylistTracks = async (playlistId, playlistName) => {
        setLoadingTracks(true);
        try {
            console.log(`Fetching tracks for playlist: ${playlistName}`);
            
            // Fetch all tracks (handle pagination)
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

            // 1. Check if the user is authenticated
            const token = localStorage.getItem('spotifyAccessToken');
            console.log('Access Token:', token ? 'EXISTS' : 'NOT FOUND');

            if (!token) {
                console.log('No token found, redirecting to home');
                navigate('/');
                return;
            }

            // 2. Fetch user data with auto-refresh
            console.log('Fetching user data...');
            const userResponse = await makeSpotifyRequest('https://api.spotify.com/v1/me');
            console.log('User data fetched successfully:', userResponse.data.display_name);
            setUserData(userResponse.data);

            // 3. Fetch user's playlists with pagination
            console.log('Fetching playlists...');
            let allPlaylists = [];
            let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
            
            while (nextUrl && allPlaylists.length < 200) { // Limit to 200 playlists
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

    // Prepare playlist for RAG processing
    const preparePlaylistForProcessing = async (playlist) => {
        await fetchPlaylistTracks(playlist.id, playlist.name);
        // Here you would typically send the tracks to your RAG processing endpoint
        console.log('Playlist ready for RAG processing:', {
            playlistId: playlist.id,
            name: playlist.name,
            trackCount: playlistTracks.length
        });
    };

    // Loading state
    // In your Dashboard component, find this section (around line 140-170):

// Loading state - REPLACE THIS ENTIRE SECTION
    if (loading) {
        return (
            <div>
                {/* Main Loading Container */}
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
                    {/* Spotify-style Loading Spinner */}
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

                    {/* Loading Text */}
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '16px'
                    }}>
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
                            margin: '0',
                            animation: 'fadeInOut 2s ease-in-out infinite'
                        }}>
                            Fetching your Spotify data...
                        </p>
                    </div>

                    {/* Progress Dots */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                    }}>
                        {[0, 1, 2].map(i => (
                            <div
                                key={i}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: '#1db954',
                                    animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`
                                }}
                            ></div>
                        ))}
                    </div>
                </div>

                {/* Animations */}
                <style jsx>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { 
                            transform: translate(-50%, -50%) scale(0.8);
                            opacity: 0.8;
                        }
                        50% { 
                            transform: translate(-50%, -50%) scale(1.1);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes glow {
                        0% { filter: brightness(1) drop-shadow(0 0 5px rgba(29, 185, 84, 0.3)); }
                        100% { filter: brightness(1.2) drop-shadow(0 0 15px rgba(29, 185, 84, 0.5)); }
                    }
                    
                    @keyframes fadeInOut {
                        0%, 100% { opacity: 0.7; }
                        50% { opacity: 1; }
                    }
                    
                    @keyframes bounce {
                        0%, 80%, 100% { 
                            transform: scale(0);
                            opacity: 0.5;
                        }
                        40% { 
                            transform: scale(1);
                            opacity: 1;
                        }
                    }
                `}</style>
            </div>
        );
    }

    // Error state
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

            {/* Playlist Section */}
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
                                
                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            preparePlaylistForProcessing(playlist);
                                        }}
                                        disabled={loadingTracks && selectedPlaylist?.id === playlist.id}
                                        style={{
                                            background: '#1db954',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            cursor: loadingTracks && selectedPlaylist?.id === playlist.id ? 'not-allowed' : 'pointer',
                                            fontSize: '0.75rem',
                                            opacity: loadingTracks && selectedPlaylist?.id === playlist.id ? 0.5 : 1
                                        }}
                                    >
                                        {loadingTracks && selectedPlaylist?.id === playlist.id ? 'Loading...' : '🎯 Analyze & Sort'}
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

            {/* Selected Playlist Details */}
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
            </div>
        </div>
    );
}