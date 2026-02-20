let socket = null;

const tunerOverlay = document.getElementById('tuner-overlay');
const freqInput = document.getElementById('freq-input');
const tuneBtn = document.getElementById('tune-btn');

// UI Elements
const statusText = document.getElementById('status');
const canvas = document.getElementById('feed');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const imgData = ctx.createImageData(1280, 720); // 720p

const extractionZone = document.getElementById('extraction-zone');
const timerText = document.getElementById('timer');
const downloadBtn = document.getElementById('download-btn');
const logConsole = document.getElementById('log-console');

function log(msg) {
  const p = document.createElement('div');
  p.className = 'log-entry';
  p.innerText = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${msg}`;
  logConsole.prepend(p);
}

// === DEMODULATION & RENDER STATE ===
let scannerState = 'SCANNING';
let bitCursor = 0;
let currentByte = 0;
let extractedBytes = [];
let encryptedSize = null;

// The "Twin-Engine" 40-Bit Shift Register for GHOST
// Hex for GHOST is 0x47484F5354
// winHigh looks for 0x47 (top 8 bits)
// winLow looks for 0x484F5354 (bottom 32 bits)
let winHigh = 0;
let winLow = 0;

// Pre-allocated Video Buffer
const FRAME_SIZE = 1280 * 720 * 3;
const frameBuffer = new Uint8Array(FRAME_SIZE);
let frameIndex = 0;

// === 1. AES-256 DECRYPTION SETUP ===
const RAW_KEY = new TextEncoder().encode("GHOST_PROTOCOL_SECRET_KEY_32BYTE");
const NONCE = new TextEncoder().encode("unique_nonce");
let cryptoKey;

async function initCrypto() {
  return await crypto.subtle.importKey(
    "raw", RAW_KEY, "AES-GCM", false, ["decrypt"]
  );
}
initCrypto().then(key => { cryptoKey = key; log("> CRYPTO_KEY ESTABLISHED."); });

// === 2. WEBSOCKET SETUP ===
tuneBtn.onclick = () => {
  const freq = freqInput.value.trim();
  if (!freq) return;

  tunerOverlay.style.display = 'none';

  socket = new WebSocket(`ws://127.0.0.1:4000/socket?freq=${freq}`);
  socket.binaryType = 'arraybuffer';

  socket.onopen = () => {
    statusText.innerText = `> LISTENING ON FREQ ${freq}...`;
    statusText.style.color = "#0f0";
    log(`WebSocket Locked to ${freq}.`);
  };

  socket.onclose = () => {
    statusText.innerText = "> SIGNAL LOST.";
    statusText.style.color = "#f00";
    statusText.classList.remove("blink");
  };

  socket.onmessage = (event) => {
    processChunk(new Uint8Array(event.data));
  };
};

// === 3. THE HYPER-FAST ENGINE ===
function processChunk(chunk) {
  for (let i = 0; i < chunk.length; i++) {
    const byte = chunk[i];

    // --- VISUALIZER ---
    frameBuffer[frameIndex++] = byte;

    if (frameIndex === FRAME_SIZE) {
      for (let px = 0, j = 0; px < FRAME_SIZE; px += 3, j += 4) {
        imgData.data[j] = frameBuffer[px];
        imgData.data[j + 1] = frameBuffer[px + 1];
        imgData.data[j + 2] = frameBuffer[px + 2];
        imgData.data[j + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      frameIndex = 0;
    }

    // --- DEMODULATOR ---
    if (scannerState !== 'DONE') {
      const bit = byte & 1; // Rip Least Significant Bit

      if (scannerState === 'SCANNING') {
        // Shift bits across the twin engines
        winHigh = ((winHigh << 1) | (winLow >>> 31)) & 0xFF;
        winLow = ((winLow << 1) | bit) >>> 0; // >>> 0 forces 32-bit unsigned math

        // Mathematically perfect check for G-H-O-S-T
        if (winHigh === 0x47 && winLow === 0x484F5354) {
          log("> MAGIC SIGNATURE DETECTED. SIGNAL LOCKED.");
          scannerState = 'EXTRACTING';
          bitCursor = 0;
          currentByte = 0;
          extractedBytes = [];
          encryptedSize = null;
        }
      }
      else if (scannerState === 'EXTRACTING') {
        currentByte = ((currentByte << 1) | bit) & 0xFF;
        bitCursor++;

        if (bitCursor === 8) {
          extractedBytes.push(currentByte);
          currentByte = 0;
          bitCursor = 0;

          if (encryptedSize === null && extractedBytes.length === 4) {
            const view = new DataView(new Uint8Array(extractedBytes).buffer);
            encryptedSize = view.getUint32(0);
            log(`> INCOMING ENCRYPTED PAYLOAD: ${encryptedSize} bytes`);
          }

          if (encryptedSize !== null && extractedBytes.length === 4 + encryptedSize) {
            scannerState = 'DONE';
            log("> EXTRACTION COMPLETE. ATTEMPTING DECRYPTION...");

            const cipherText = new Uint8Array(extractedBytes.slice(4));
            decryptAndUnpack(cipherText);

            setTimeout(() => {
              scannerState = 'SCANNING';
              winHigh = 0;
              winLow = 0;
              log("> SCANNER RESET. LISTENING FOR NEXT DROP.");
            }, 16000);
          }
        }
      }
    }
  }
}

// === 4. DECRYPTION & WIPE ===
async function decryptAndUnpack(cipherText) {
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: NONCE },
      cryptoKey,
      cipherText
    );

    const decArray = new Uint8Array(decryptedBuffer);
    const view = new DataView(decArray.buffer);

    const nameLen = view.getUint32(0);
    const nameBytes = decArray.slice(4, 4 + nameLen);
    const fileName = new TextDecoder().decode(nameBytes);
    const fileData = decArray.slice(4 + nameLen + 8);

    log(`> DECRYPTION SUCCESSFUL: [${fileName}]`);
    triggerSelfDestruct(fileName, fileData);

  } catch (e) {
    log("> DECRYPTION FAILED. UNAUTHORIZED INTERCEPT.");
    console.error(e);
  }
}

// === 5. BURN AFTER READING SEQUENCE ===
let currentCountdown = null; // Track timer globally to prevent overlaps

function triggerSelfDestruct(fileName, fileData) {
  // 1. Reset UI State for the new drop
  extractionZone.classList.remove('hidden');
  downloadBtn.classList.remove('hidden'); // <--- THE FIX: Bring the button back!

  let timeLeft = 15.00;

  // 2. Clear any lingering timers
  if (currentCountdown) clearInterval(currentCountdown);

  // 3. Assign Download action
  downloadBtn.onclick = () => {
    const blob = new Blob([fileData], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    log(`> PAYLOAD [${fileName}] EXTRACTED SECURELY.`);
  };

  // 4. Self-Destruct Timer
  currentCountdown = setInterval(() => {
    timeLeft -= 0.05;
    timerText.innerText = `TIME TO DELETION: ${timeLeft.toFixed(2)}s`;

    if (timeLeft <= 0) {
      clearInterval(currentCountdown);
      timerText.innerText = ">> TRACE ERASED <<";

      // WIPE THE MEMORY
      fileData.fill(0);
      extractedBytes = [];

      downloadBtn.classList.add('hidden'); // Hide it again for the next cycle
      log("> MEMORY PURGED. FILE DESTROYED.");
    }
  }, 50);
}