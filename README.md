<div align="center">
  <h1>👻 GHOST_FS</h1>
  <p><strong>A highly secure, zero-cost, ephemeral file transfer system leveraging WebCrypto and LSB video steganography.</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Elixir](https://img.shields.io/badge/Elixir-1.19.5-purple.svg)](https://elixir-lang.org/)
  [![Status](https://img.shields.io/badge/Status-Active-success.svg)]()
</div>

<br/>

## 📖 Overview

GhostFS allows two users to securely transfer files of any size without leaving a trace. It achieves true **Zero-Knowledge End-to-End Encryption (E2EE)** by executing AES-256-GCM entirely within the browser. 

Instead of sending raw encrypted data over the wire (which can be flagged or blocked), GhostFS embeds the encrypted payload into the **Least Significant Bits (LSBs)** of raw HTML5 video frames using the Canvas API. These frames are streamed over a high-throughput Elixir WebSocket relay.

Because the encryption happens entirely locally and the server only sees visual static, the system guarantees that the data mathematically cannot be intercepted or read by anyone other than the intended receiver.

---

## ✨ Features

- **True E2EE (Zero-Knowledge):** Keys are generated ephemerally in the browser using `window.crypto.subtle`. The server never sees the key.
- **LSB Steganography:** Encrypted data is hidden inside a decoy video stream at 60fps.
- **Self-Destructing Payloads:** Data is kept entirely in RAM and deleted automatically upon extraction.
- **Zero-Cost Architecture:** Completely decoupled frontend and backend designed to run on free-tier cloud platforms.
- **Burn Protocol:** If the sender disconnects, the channel is immediately scorched and data is permanently severed.

---

## 🏗️ Architecture

The project has been migrated from a legacy Rust CLI implementation to a **Zero-Cost Web Architecture**, completely eliminating the need for client-side installations.

### `/frontend` (Vanilla HTML/JS/CSS)
The client-side encoder/decoder. 
- Utilizes `window.crypto.subtle` for hardware-accelerated AES-256-GCM encryption.
- Modulates encrypted binary data directly into the `<canvas>` pixel buffer.
- Demodulates and authenticates received bytes on the fly.
- Fully static. Can be hosted for $0 on Vercel, Netlify, or Firebase Hosting.

### `/backend` (Elixir/Phoenix)
A stateless, ultra-high-throughput WebSocket relay.
- Built on Cowboy and the Erlang VM (BEAM).
- Acts strictly as a dumb pipe connecting Senders to Receivers via dynamic frequency channels.
- Can be hosted for $0 on Fly.io or Render.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6), HTML5 Canvas API, WebCrypto API, Phosphor Icons
- **Backend:** Elixir, Phoenix PubSub, Plug, Cowboy (Erlang VM)
- **Deployment:** Vercel (Frontend), Fly.io (Backend)

---

## 🚀 Getting Started

To run GhostFS locally for development and testing:

### 1. Start the Relay Server (Backend)
1. Ensure Elixir is installed (`brew install elixir`).
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies and start the server:
   ```bash
   mix deps.get
   iex -S mix
   ```
*(The relay will listen on `localhost:4000`)*

### 2. Start the Client (Frontend)
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Start a basic HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser to `http://localhost:8000`

---

## 🐛 Known Issues & Limitations

- **Browser Throttling:** If you switch tabs during a transfer, most modern browsers will throttle `requestAnimationFrame` down to 1fps to save battery, drastically reducing transfer speeds. **Keep the tab focused during large transfers.**
- **Mobile Support:** While functional, heavy Canvas API pixel manipulation is extremely resource-intensive and may cause battery drain or thermal throttling on older mobile devices.
- **File Size Limits:** Because the decryption is performed in RAM, extremely large files (>1GB) may cause out-of-memory (OOM) errors in the browser depending on the user's available memory.

---

## 🔒 Security Notice

While GhostFS uses military-grade AES-256-GCM encryption, **no system is infallible**. 
- The decryption key is transmitted via the URL fragment (`#key=...`). URL fragments are *not* sent to the server in HTTP requests, but they can remain in browser history. 
- Always ensure you share the generated link over a secure, encrypted channel (like Signal or WhatsApp).

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
