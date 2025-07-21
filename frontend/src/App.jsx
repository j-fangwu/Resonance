import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import SpotifyLogin from './SpotifyLogin.jsx'
import Callback from './Callback.jsx'
import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={    
          <div className="App">
            <h1>Welcome to Resonance</h1>
            <SpotifyLogin />
            <button onClick={() => window.location.href = '/callback'}>
              Go to Callback
            </button>
          </div>
        } />
        <Route path="/callback" element={<Callback />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;
