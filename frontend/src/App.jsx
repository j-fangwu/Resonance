import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import SpotifyLogin from './SpotifyLogin.jsx';
import Callback from './Callback.jsx';
import Dashboard from './Dashboard.jsx';
import DebugPage from './DebugPage.jsx'; // Add this import
import './App.css';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function App() {
  const [count, setCount] = useState(0);

  return (
    <BrowserRouter>
      <Routes>
        {/* Home Route */}
        <Route path="/" element={    
          <div className="App">
            <div>
              <a href="https://vitejs.dev" target="_blank">
                <img src={viteLogo} className="logo" alt="Vite logo" />
              </a>
              <a href="https://react.dev" target="_blank">
                <img src={reactLogo} className="logo react" alt="React logo" />
              </a>
            </div>
            <h1>Welcome to Resonance</h1>
            <SpotifyLogin />
            <div className="card">
              <button onClick={() => setCount((count) => count + 1)}>
                count is {count}
              </button>
            </div>
            {/* Navigation Links */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Link to="/callback" className="callback-link" style={{
                padding: '8px 16px',
                backgroundColor: '#646cff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
              }}>
                Test Callback Route
              </Link>
              <Link to="/debug" style={{
                padding: '8px 16px',
                backgroundColor: '#ff6b35',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
              }}>
                🔍 Debug Panel
              </Link>
            </div>
          </div>
        } />

        {/* Debug Route - Add this */}
        <Route path="/debug" element={<DebugPage />} />

        {/* Auth Routes */}
        <Route path="/callback" element={<Callback />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* 404 Fallback */}
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;