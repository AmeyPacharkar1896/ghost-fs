// receiver.js - Handles Demodulation and Decoding

const receiver = {
    ws: null,
    canvas: null,
    ctx: null,
    
    // Demodulation State
    isExtracting: false,
    extractionComplete: false,
    
    allBits: [],
    currentByte: 0,
    bitCount: 0,
    
    // Header parsing state
    magicFound: false,
    headerFound: false,
    expectedSize: 0,
    nonceBytes: null,
    encryptedBuffer: null,
    bytesExtracted: 0,
    
    // Final Payload
    decryptedFileBytes: null,
    decryptedFileName: null,
    
    // Timers
    burnoutTimer: null,
    timeLeft: 10.0,
    
    init() {
        this.canvas = document.getElementById('receiver-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    },
    
    connect() {
        const channel = document.getElementById('rx-channel').value;
        const key = document.getElementById('rx-key').value;
        
        if (!channel || !key) {
            app.showToast("Channel Frequency and Decryption Key are required.", "error");
            return;
        }
        
        app.state.channel = channel;
        app.state.key = key;
        
        document.getElementById('receiver-setup').classList.add('hidden');
        document.getElementById('receiver-active-state').classList.remove('hidden');
        document.getElementById('rx-freq-display').innerText = channel;
        
        const wsUrl = app.getWsUrl(channel, 'receiver');
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer'; // Crucial for receiving raw frames
        
        this.ws.onopen = () => {
            this.isExtracting = true;
            document.getElementById('rx-progress-container').classList.remove('hidden');
            console.log("WebSocket connected. Listening for GHOST signature...");
        };
        
        this.ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                this.handleVideoChunk(new Uint8Array(event.data));
            }
        };
        
        this.ws.onclose = () => {
            this.handleSeveredConnection();
        };
    },
    
    handleVideoChunk(rgbBuffer) {
        // 1. Render to Canvas (convert RGB24 to RGBA32 for Canvas API)
        const frameData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        let rgbIdx = 0;
        for (let i = 0; i < frameData.data.length; i += 4) {
            frameData.data[i] = rgbBuffer[rgbIdx++];     // R
            frameData.data[i+1] = rgbBuffer[rgbIdx++];   // G
            frameData.data[i+2] = rgbBuffer[rgbIdx++];   // B
            frameData.data[i+3] = 255;                   // Alpha
        }
        this.ctx.putImageData(frameData, 0, 0);
        
        // 2. Demodulation (if not complete)
        if (this.isExtracting && !this.extractionComplete) {
            this.demodulateFrame(rgbBuffer);
        }
    },
    
    demodulateFrame(rgbBuffer) {
        // We injected into the R channel, which corresponds to every 3rd byte in the RGB24 buffer
        for (let i = 0; i < rgbBuffer.length; i += 3) {
            const bit = rgbBuffer[i] & 1;
            this.currentByte = (this.currentByte << 1) | bit;
            this.bitCount++;
            
            if (this.bitCount === 8) {
                
                // STATE 3: Extracting encrypted payload bytes
                if (this.headerFound && this.bytesExtracted < this.expectedSize) {
                    this.encryptedBuffer[this.bytesExtracted] = this.currentByte;
                    this.bytesExtracted++;
                    
                    // Update Progress Bar (throttle DOM updates if needed, but this is fine for now)
                    if (this.bytesExtracted % 1024 === 0 || this.bytesExtracted === this.expectedSize) {
                        const percentage = (this.bytesExtracted / this.expectedSize) * 100;
                        document.getElementById('rx-progress').style.width = percentage + "%";
                    }
                    
                    if (this.bytesExtracted === this.expectedSize) {
                        this.finishExtraction();
                        return; // Done! Stop parsing frame
                    }
                } 
                // STATE 2: Parsing 16-byte Header (Nonce + Size)
                else if (this.magicFound && !this.headerFound) {
                    this.allBits.push(this.currentByte);
                    
                    if (this.allBits.length === 16) {
                        this.nonceBytes = new Uint8Array(this.allBits.slice(0, 12));
                        
                        const sizeBytes = new Uint8Array(this.allBits.slice(12, 16));
                        const view = new DataView(sizeBytes.buffer);
                        this.expectedSize = view.getUint32(0, false); // Big Endian
                        
                        this.encryptedBuffer = new Uint8Array(this.expectedSize);
                        this.headerFound = true;
                        this.allBits = []; // Clear memory
                    }
                } 
                // STATE 1: Searching for 'GHOST' Magic Signature
                else if (!this.magicFound) {
                    this.allBits.push(this.currentByte);
                    
                    if (this.allBits.length >= 5) {
                        const tail = this.allBits.slice(-5);
                        if (tail[0] === 0x47 && tail[1] === 0x48 && tail[2] === 0x4F && tail[3] === 0x53 && tail[4] === 0x54) {
                            this.magicFound = true;
                            this.allBits = []; // Clear array, ready for Header
                            
                            document.getElementById('rx-stats').innerText = "SIGNATURE DETECTED. EXTRACTING PAYLOAD...";
                            document.getElementById('rx-stats').style.color = "#00ff88";
                        }
                    }
                    // Keep array from growing infinitely while searching
                    if (this.allBits.length > 100) {
                        this.allBits.shift(); 
                    }
                }

                // Reset byte accumulator
                this.currentByte = 0;
                this.bitCount = 0;
            }
        }
    },
    
    async finishExtraction() {
        this.extractionComplete = true;
        document.getElementById('rx-stats').innerText = "DECRYPTING IN MEMORY...";
        document.getElementById('rx-stats').style.color = "#ffaa00";
        
        try {
            const { filename, fileData } = await CryptoUtils.decryptPayload(this.encryptedBuffer, this.nonceBytes, app.state.key);
            this.decryptedFileName = filename;
            this.decryptedFileBytes = fileData;
            
            // Show Burnout UI
            document.querySelector('.scanline-effect').classList.remove('scanline-effect'); // Stop effects
            document.getElementById('rx-stats').innerText = "PAYLOAD READY FOR EXTRACTION";
            document.getElementById('rx-stats').style.color = "#00cc6a";
            
            document.getElementById('burnout-container').classList.remove('hidden');
            
            // Start the 10 second burnout timer locally
            this.startBurnoutTimer();
            
        } catch (e) {
            document.getElementById('rx-stats').innerText = "DECRYPTION FAILED. INCORRECT KEY.";
            document.getElementById('rx-stats').style.color = "#ff3333";
        }
    },
    
    startBurnoutTimer() {
        this.timeLeft = 10.0;
        this.burnoutTimer = setInterval(() => {
            this.timeLeft -= 0.1;
            document.getElementById('burnout-timer').innerText = this.timeLeft.toFixed(1);
            
            if (this.timeLeft <= 0) {
                this.triggerBurnout();
            }
        }, 100);
    },
    
    triggerBurnout() {
        clearInterval(this.burnoutTimer);
        
        // Memory Wipe
        this.decryptedFileBytes = null;
        this.encryptedBuffer = null;
        this.nonceBytes = null;
        this.allBits = [];
        
        if (this.ws) {
            this.ws.close();
        }
        
        app.showToast("TIMELIMIT REACHED. PAYLOAD DESTROYED.", "error");
        setTimeout(() => app.showLanding(), 1500);
    },
    
    downloadPayload() {
        if (!this.decryptedFileBytes) return;
        
        // Convert to Blob and trigger download
        const blob = new Blob([this.decryptedFileBytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ghost_" + this.decryptedFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Immediately burn it after download
        this.triggerBurnout();
    },
    
    handleSeveredConnection() {
        if (!this.extractionComplete) {
            app.showToast("SENDER SCORCHED THE FREQUENCY. CONNECTION LOST.", "error");
            setTimeout(() => app.showLanding(), 2000);
        }
    }
};

window.addEventListener('DOMContentLoaded', () => receiver.init());
