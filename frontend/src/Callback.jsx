function Callback() {
    return (
        <div>
            <h1>Callback Page</h1>
            <p>This is where you would handle the Spotify callback.</p>
            <button onClick={() => window.location.href = '/'}>
                Go Back to Home
            </button>
        </div>
    );
}

export default Callback;