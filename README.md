
# GHOST_FS :: Covert Steganographic File System

GhostFS is a military-grade, ephemeral data transmission pipeline. It covertly streams heavily encrypted files by hiding the payload data inside the microscopic color margins (Least Significant Bit) of a continuously looping, live video broadcast. 

To an outside observer or network sniffer, the stream looks like a standard, uninteresting video feed (e.g., a CCTV camera or decoy footage). To a client holding the exact frequency and decryption key, it is a high-speed, invisible file transfer protocol with built-in "Scorched Earth" destruction mechanisms.

## ⚡ Core Features

* **LSB Video Steganography:** Injects binary payload data directly into the Least Significant Bits of raw RGB video frames in real-time.
* **Scorched-Earth Frequency Hopping:** Connections are strictly ephemeral. Once a file finishes transmitting, the server enforces a 15-second "Burn After Reading" timer before violently severing the connection, destroying the frequency, and hopping to a new one.
* **AES-256-GCM Encryption:** All payloads are encrypted before injection, utilizing unique nonces and a 32-byte secret key.
* **Zero-Trace Web Demodulator:** The frontend utilizes a background Web Worker running a 40-bit shift register to detect the `GHOST` magic signature without dropping video frames. It decrypts, serves the file entirely in memory, and safely zeroes out the memory buffers the moment the timer expires.
* **High-Performance Canvas Rendering:** Uses 32-bit bulk memory writes to render the decoded 720p video feed in the browser at 25fps without choking the main UI thread.

## 🏗️ System Architecture

GhostFS is a decoupled, three-node system:

1. **The Encoder (Rust):** The brain of the operation. Generates burner frequencies, handles AES-256 encryption, and manipulates raw video bytes. It pipes a continuous decoy video through FFmpeg, injects the payload on command, and POSTs the raw stream to the Switchboard.
2. **The Switchboard (Elixir / Phoenix):** A blind, hyper-concurrent relay. It uses Phoenix PubSub to ingest the raw video chunk stream from Rust and fans it out to connected WebSocket clients based on the current active frequency. It actively enforces the `:burn_frequency` kill-switches sent by the Encoder.
3. **The Demodulator (JavaScript / HTML5):** The tactical client tuner. It connects via WebSockets, renders the green-tinted video feed, and silently listens for the magic bytes. When a file is caught, it handles decryption, triggers the extraction UI, and manages the visual blackout when a frequency is scorched.


## 🛠️ Technical Challenges & Solutions

### 1. The Main-Thread Bottleneck (Video vs. Decryption)

**Challenge:** Processing 1280x720 raw video frames at 25 FPS while simultaneously running a 40-bit shift register and AES-GCM decryption caused significant UI stutter and dropped frames.
**Solution:** Architected a multi-threaded frontend approach. The video rendering remains on the main thread using **32-bit Uint32Array bulk memory writes** to the Canvas API, while the entire demodulation and cryptography engine was offloaded to a **Web Worker**. This decoupling ensured a smooth 25 FPS visualizer regardless of the payload size.

### 2. Time-of-Flight Synchronization (The 15s Death Timer)

**Challenge:** Network transit and decryption latency caused the frontend "Self-Destruct" timer to start ~2 seconds after the backend "Scorch" timer. This resulted in the server destroying the frequency while the UI claimed the user still had time to download.
**Solution:** Implemented a **Server Authority** model with a **Transit Buffer**. The Rust encoder was updated to provide an 18-second window (15s for UI + 3s buffer), while the JavaScript client was programmed to immediately assassinate its local timer and wipe memory the moment the WebSocket connection is severed by the host.

### 3. Bit-Stream Alignment & Stride

**Challenge:** Maintaining perfect bit-alignment across asynchronous WebSocket chunks. If a single byte was dropped or misaligned, the 40-bit shift register would fail to detect the `GHOST` signature.
**Solution:** Utilized a **Twin-Engine Shift Register** logic (`winHigh` and `winLow`) to treat the incoming LSB stream as a continuous bit-pipe. By using unsigned 32-bit mathematical shifts (`>>> 0`), we ensured that the signature detection remained bit-perfect even across chunk boundaries.

---

## 📈 Future Roadmap

* **Spread Spectrum Transmission:** Shredding a single file across 3+ simultaneous burner frequencies to prevent single-channel interception.
* **Spectrogram Signaling:** Hiding the AES Nonce and Payload Size in the audio frequency spectrum of the decoy video.
* **Auto-Tuning:** Injecting the *next* active frequency into the footer of the current encrypted payload for seamless client handovers.

---

## 🚀 Getting Started

### Prerequisites
* **Rust & Cargo** (For the Encoder)
* **Elixir & Erlang/OTP** (For the Switchboard)
* **FFmpeg** (Must be installed and available in your system's PATH)
* A modern web browser with Web Worker support.

### 1. Start the Elixir Switchboard
Navigate to the Elixir backend directory and start the Phoenix server:
```bash
cd broadcast_relay
mix deps.get
iex -S mix phx.server

```

*The Switchboard will now listen for incoming streams on port 4000.*

### 2. Boot the Rust Encoder

Navigate to the Rust encoder directory. Ensure you have a `decoy.mp4` file in the root of the Rust project.

```bash
cd broadcast_fs
cargo run --release

```

*The terminal will boot up and provide you with the initial active Burner Frequency (e.g., `847.29`).*

### 3. Tune In & Intercept

1. Serve the frontend folder (using Live Server, Python's `http.server`, or similar).
2. Open `index.html` in your browser.
3. Enter the active frequency provided by the Rust terminal and click **[ LOCK SIGNAL ]**.
4. In the Rust terminal, type the name of a file you want to transmit (e.g., `secret.pdf`) and hit Enter.
5. Watch the payload get extracted in real-time. You have 15 seconds to extract it before the channel is permanently burned.

## 🔒 Cryptography & Security Notes

* **Magic Signature:** The system relies on a 40-bit magic signature (`0x47484F5354` / "GHOST") prepended to the encrypted payload to signal the demodulator to begin extraction.
* **Payload Structure:** `[ Magic Bytes (5) | Encrypted Size (4) | AES-256-GCM Payload ]`
* **Network Obfuscation:** Because the data is wrapped inside continuous raw video frames via standard HTTP/WebSocket protocols, standard Deep Packet Inspection (DPI) will classify the traffic as a standard video stream.

## ⚠️ Disclaimer

**GhostFS is an experimental proof-of-concept built for educational and research purposes.** Do not use this system for transmitting highly sensitive data in a production environment without proper key exchange infrastructure (currently uses a hardcoded symmetric key) and rigorous security auditing.

---

*Developed as an exploration into real-time steganography, concurrent systems, and ephemeral network architecture.*

