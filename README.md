# GhostFS :: Secure Ephemeral Transfer

GhostFS is a high-security, Zero-Cost, ephemeral file transfer system. It achieves true Zero-Knowledge End-to-End Encryption (E2EE) by executing AES-256-GCM entirely within the browser, embedding the encrypted payload into the Least Significant Bits (LSBs) of raw HTML5 video frames, and streaming them across an Elixir/Phoenix WebSocket relay.

## Architecture

The project has been migrated from a legacy Rust CLI implementation to a **Zero-Cost Web Architecture**, completely eliminating the need for client-side installations.

### `/frontend` (Vanilla HTML/JS/CSS)
The client-side encoder/decoder. 
- Utilizes `window.crypto.subtle` for hardware-accelerated AES-256-GCM encryption.
- Modulates encrypted binary data directly into the `<canvas>` pixel buffer at 60fps.
- Streams frame data via WebSockets.
- Fully static. Can be hosted for $0 on Vercel, Netlify, or Firebase Hosting.

### `/backend` (Elixir/Phoenix)
A stateless, ultra-high-throughput WebSocket relay.
- Built on Cowboy and the Erlang VM (BEAM).
- Acts strictly as a dumb pipe connecting Senders to Receivers via dynamic frequency channels.
- Can be hosted for $0 on Fly.io or Render.

## Development

### Running the Backend
1. Ensure Elixir is installed (`brew install elixir`).
2. Navigate to `cd backend`
3. Install dependencies: `mix deps.get`
4. Run the server: `iex -S mix`
*(The relay will listen on `localhost:4000`)*

### Running the Frontend
1. Open a new terminal.
2. Navigate to `cd frontend`
3. Start a basic HTTP server: `python3 -m http.server 8000`
4. Open your browser to `http://localhost:8000`
