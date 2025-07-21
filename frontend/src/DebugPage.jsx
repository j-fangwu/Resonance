// DebugPage.jsx - Add this to your frontend for testing
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DebugPage() {
    const [serverHealth, setServerHealth] = useState(null);
    const [envCheck, setEnvCheck] = useState(null);
    const [authUrl, setAuthUrl] = useState('');
    const [logs, setLogs] = useState([]);

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    useEffect(() => {
        checkServerHealth();
        checkEnvironment();
        generateAuthUrl();
    }, []);

    const checkServerHealth = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/health');
            setServerHealth(response.data);
            addLog('✅ Server health check passed', 'success');
        } catch (error) {
            addLog('❌ Server health check failed: ' + error.message, 'error');
        }
    };

    const checkEnvironment = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/debug/env');
            setEnvCheck(response.data);
            addLog('✅ Environment check completed', 'success');
        } catch (error) {
            addLog('❌ Environment check failed: ' + error.message, 'error');
        }
    };

    const generateAuthUrl = () => {
        const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
        const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
        
        if (!clientId || !redirectUri) {
            addLog('❌ Missing frontend environment variables', 'error');
            return;
        }

        const scopes = [
            'user-read-private',
            'user-read-email',
            'playlist-read-private',
            'playlist-read-collaborative'
        ];

        const url = `https://accounts.spotify.com/authorize?` +
            `response_type=code&` +
            `client_id=${clientId}&` +
            `scope=${encodeURIComponent(scopes.join(' '))}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `show_dialog=true&` +
            `state=debug-test`;

        setAuthUrl(url);
        addLog('✅ Auth URL generated', 'success');
    };

    const testDirectAuth = async () => {
        // Get code from URL if we're on callback
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (!code) {
            addLog('❌ No code in URL. Please go through auth flow first.', 'error');
            return;
        }

        addLog('📤 Testing token exchange with code: ' + code.substring(0, 20) + '...', 'info');

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/spotify/auth', { code });
            addLog('✅ Token exchange successful!', 'success');
            addLog('Token preview: ' + response.data.access_token?.substring(0, 20) + '...', 'success');
            
            // Test the token
            const testResponse = await axios.get('http://127.0.0.1:8000/api/test/token', {
                headers: { Authorization: `Bearer ${response.data.access_token}` }
            });
            addLog('✅ Token validation successful! User: ' + testResponse.data.user, 'success');
            
        } catch (error) {
            addLog('❌ Token exchange failed: ' + (error.response?.data?.details || error.message), 'error');
            if (error.response?.data) {
                addLog('Error details: ' + JSON.stringify(error.response.data, null, 2), 'error');
            }
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
            <h1>🔍 Spotify Auth Debug Panel</h1>
            
            {/* Server Health */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#333', borderRadius: '5px' }}>
                <h2>Server Health</h2>
                <pre>{JSON.stringify(serverHealth, null, 2)}</pre>
            </div>

            {/* Environment Check */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#333', borderRadius: '5px' }}>
                <h2>Environment Variables</h2>
                <div>
                    <h3>Frontend (.env):</h3>
                    <p>VITE_SPOTIFY_CLIENT_ID: {import.meta.env.VITE_SPOTIFY_CLIENT_ID ? '✅ SET' : '❌ MISSING'}</p>
                    <p>VITE_SPOTIFY_REDIRECT_URI: {import.meta.env.VITE_SPOTIFY_REDIRECT_URI || '❌ MISSING'}</p>
                    
                    <h3>Backend (from API):</h3>
                    {envCheck && (
                        <div>
                            <p>Client ID Set: {envCheck.clientIdSet ? '✅ YES' : '❌ NO'}</p>
                            <p>Client Secret Set: {envCheck.clientSecretSet ? '✅ YES' : '❌ NO'}</p>
                            <p>Redirect URI: {envCheck.redirectUri || '❌ MISSING'}</p>
                            <p>All Variables Present: {envCheck.allEnvVarsPresent ? '✅ YES' : '❌ NO'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Auth URL */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#333', borderRadius: '5px' }}>
                <h2>Authentication</h2>
                {authUrl ? (
                    <div>
                        <button 
                            onClick={() => window.location.href = authUrl}
                            style={{ 
                                padding: '10px 20px', 
                                backgroundColor: '#1db954', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '5px',
                                cursor: 'pointer',
                                marginBottom: '10px'
                            }}
                        >
                            🎵 Start Spotify Auth Flow
                        </button>
                        <br />
                        <button 
                            onClick={testDirectAuth}
                            style={{ 
                                padding: '10px 20px', 
                                backgroundColor: '#ff6b35', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            🧪 Test Token Exchange (if code in URL)
                        </button>
                    </div>
                ) : (
                    <p>❌ Cannot generate auth URL - check environment variables</p>
                )}
            </div>

            {/* Logs */}
            <div style={{ padding: '15px', backgroundColor: '#333', borderRadius: '5px' }}>
                <h2>Debug Logs</h2>
                <button 
                    onClick={() => setLogs([])}
                    style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#666', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '3px',
                        cursor: 'pointer',
                        marginBottom: '10px'
                    }}
                >
                    Clear Logs
                </button>
                <div style={{ height: '300px', overflow: 'auto', backgroundColor: '#222', padding: '10px', borderRadius: '3px' }}>
                    {logs.map((log, index) => (
                        <div key={index} style={{ 
                            color: log.type === 'error' ? '#ff6b6b' : log.type === 'success' ? '#51cf66' : '#74c0fc',
                            marginBottom: '5px'
                        }}>
                            <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}