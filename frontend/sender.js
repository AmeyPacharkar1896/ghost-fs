// sender.js - Handles Transmission Logic

const sender = {
    fileBytes: null,
    fileName: null,
    encryptedPayload: null,
    ws: null,
    isBroadcasting: false,
    
    // Video / Canvas references
    video: null,
    canvas: null,
    ctx: null,
    
    // Injection State
    byteCursor: 0,
    bitCursor: 0,
    burnoutTimer: null,
    
    async init() {
        this.video = document.getElementById('decoy-video');
        this.canvas = document.getElementById('sender-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // Listen for file selection
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileSelect(e));
    },
    
    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        this.fileName = file.name;
        document.getElementById('sender-filename').innerText = file.name;
        document.getElementById('sender-filesize').innerText = app.bytesToSize(file.size);
        
        // Load into memory
        const buffer = await file.arrayBuffer();
        this.fileBytes = new Uint8Array(buffer);
        
        // Generate Channel and Key
        app.state.channel = app.generateChannelId();
        app.state.key = await CryptoUtils.generateEphemeralKey();
        
        document.getElementById('sender-freq').innerText = app.state.channel;
        
        // Generate Secure Link
        const link = `${window.location.origin}${window.location.pathname}#channel=${app.state.channel}&key=${app.state.key}`;
        document.getElementById('invite-link').value = link;
        
        // Encrypt the payload now so it's ready for real-time injection
        document.getElementById('sender-stats').innerText = "ENCRYPTING PAYLOAD...";
        this.encryptedPayload = await CryptoUtils.encryptPayload(this.fileName, this.fileBytes, app.state.key);
        
        document.getElementById('sender-stats').innerText = "AWAITING RECEIVER CONNECTION...";
        
        // Toggle UI
        document.getElementById('drop-zone').classList.add('hidden');
        document.getElementById('sender-active-state').classList.remove('hidden');
        
        // Pre-render one frame to show it's ready
        this.video.currentTime = 0;
        this.video.addEventListener('canplay', () => {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        }, { once: true });
    },
    
    copyLink() {
        const link = document.getElementById('invite-link');
        link.select();
        document.execCommand("copy");
        app.showToast("Secure link copied!", "success");
    },
    
    startBroadcast() {
        if (this.isBroadcasting) return;
        
        // Connect to Elixir as a sender
        const wsUrl = app.getWsUrl(app.state.channel, 'sender');
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isBroadcasting = true;
            document.getElementById('sender-stats').innerText = "TRANSMITTING DATA [LSB INJECTION ACTIVE]";
            document.getElementById('btn-start-broadcast').disabled = true;
            document.getElementById('btn-start-broadcast').innerText = "TRANSMISSION IN PROGRESS";
            
            // Start Video Loop
            this.video.play();
            this.byteCursor = 0;
            this.bitCursor = 0;
            
            requestAnimationFrame(() => this.processFrame());
        };
        
        this.ws.onclose = () => {
            this.stopBroadcast();
        };
    },
    
    processFrame() {
        if (!this.isBroadcasting) return;
        
        // 1. Draw video frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // 2. Extract raw pixels
        const frameData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = frameData.data; // RGBA array
        
        // 3. Inject Payload into LSB of Red Channel (or all color channels)
        // For simplicity and speed, we inject into the R channel (index % 4 === 0)
        let finishedInjecting = false;
        
        // Only inject if we haven't finished
        if (this.byteCursor < this.encryptedPayload.length) {
            for (let i = 0; i < pixels.length; i += 4) { // Step by 4 to hit Red channel
                if (this.byteCursor < this.encryptedPayload.length) {
                    const bit = (this.encryptedPayload[this.byteCursor] >> (7 - this.bitCursor)) & 1;
                    pixels[i] = (pixels[i] & 0xFE) | bit; // Zero out LSB, inject bit
                    
                    this.bitCursor++;
                    if (this.bitCursor === 8) {
                        this.bitCursor = 0;
                        this.byteCursor++;
                    }
                } else {
                    finishedInjecting = true;
                    break;
                }
            }
            
            // Update canvas with modified pixels (optional, but good for local visual feedback)
            this.ctx.putImageData(frameData, 0, 0);
        } else {
            finishedInjecting = true;
        }
        
        // 4. Send raw RGB frame to WebSocket
        // Remove Alpha channel for Elixir/Receiver to save 25% bandwidth (RGB24 instead of RGBA32)
        const rgbBuffer = new Uint8Array(this.canvas.width * this.canvas.height * 3);
        let rgbIdx = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            rgbBuffer[rgbIdx++] = pixels[i];     // R (contains payload)
            rgbBuffer[rgbIdx++] = pixels[i + 1]; // G
            rgbBuffer[rgbIdx++] = pixels[i + 2]; // B
        }
        
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(rgbBuffer);
        }
        
        if (finishedInjecting && !this.burnoutTimer) {
            document.getElementById('sender-stats').innerText = "TRANSMISSION COMPLETE. COUNTING DOWN TO BURNOUT...";
            document.getElementById('sender-stats').style.color = "#ff3333";
            
            this.burnoutTimer = setTimeout(() => {
                this.ws.close(); // Triggers Elixir :burn_frequency
            }, 15000); // 15 seconds
        }
        
        // Loop
        requestAnimationFrame(() => this.processFrame());
    },
    
    stopBroadcast() {
        this.isBroadcasting = false;
        this.video.pause();
        clearTimeout(this.burnoutTimer);
        
        // Memory Wipe
        this.fileBytes = null;
        this.encryptedPayload = null;
        
        app.showToast("BURN PROTOCOL EXECUTED. Channel Destroyed.", "error");
        setTimeout(() => app.showLanding(), 1500); // Return to home gracefully
    }
};

window.addEventListener('DOMContentLoaded', () => sender.init());
