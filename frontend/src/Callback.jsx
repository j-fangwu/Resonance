import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Callback() {
    const navigate = useNavigate();
    const hasProcessedRef = useRef(false);

    useEffect(() => {
        // Prevent double execution in React Strict Mode
        if (hasProcessedRef.current) {
            console.log('Auth already processed, skipping...');
            return;
        }
        hasProcessedRef.current = true;

        const exchangeCodeForToken = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const error = params.get('error');

            console.log('Processing auth callback with code:', code ? 'EXISTS' : 'MISSING');

            // Handle user cancellation or errors from Spotify
            if (error) {
                console.error('Spotify auth error:', error);
                navigate('/');
                return;
            }

            if (code) {
                try {
                    console.log('Making token exchange request...');
                    const response = await axios.post('http://127.0.0.1:8000/api/spotify/auth', { code });
                    const accessToken = response.data.access_token || response.data.accessToken;

                    console.log('Access token received:', accessToken ? 'SUCCESS' : 'MISSING');

                    if (accessToken) {
                        localStorage.setItem('spotifyAccessToken', accessToken);
                        console.log('Token stored, navigating to dashboard');
                        
                        // Clear the URL to prevent reprocessing on refresh
                        window.history.replaceState({}, document.title, "/callback");
                        
                        navigate('/dashboard');
                    } else {
                        throw new Error('No access token in response');
                    }
                } catch (error) {
                    console.error('Auth failed:', error.response?.data || error.message);
                    
                    // Check if this is just a duplicate request (code already used)
                    if (error.response?.data?.error === 'invalid_grant') {
                        console.log('Auth code already used - checking if we have a token...');
                        const existingToken = localStorage.getItem('spotifyAccessToken');
                        if (existingToken) {
                            console.log('Found existing token, proceeding to dashboard');
                            navigate('/dashboard');
                            return;
                        }
                    }
                    
                    // Show user-friendly error message
                    alert('Authentication failed. Please try again.');
                    navigate('/');
                }
            } else {
                console.error('No code parameter found');
                navigate('/');
            }
        };

        exchangeCodeForToken();
    }, []); // Empty dependency array

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            backgroundColor: '#1a1a1a',
            color: 'white'
        }}>
            <div style={{ textAlign: 'center' }}>
                <h2>Authenticating with Spotify...</h2>
                <p>Please wait while we complete your login.</p>
            </div>
        </div>
    );
}