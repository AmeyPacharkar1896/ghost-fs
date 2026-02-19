const socket = new WebSocket('ws://127.0.0.1:4000/socket');
socket.binaryType = 'arraybuffer';

// UI Elements
const statusText = document.getElementById('status');
const canvas = document.getElementById('feed');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const imgData = ctx.createImageData(1280, 720); // 720p

const extractionZone = document.getElementById('extraction-zone');
const timerText = document.getElementById('timer');
const downloadBtn = document.getElementById('download-btn');
const logConsole = document.getElementById('log-console');

// Demodulation State
let extracting = true;
let bitCursor = 0;
let currentByte = 0;
let extractedBytes = [];
let encryptedSize = null;

// Video rendering buffer
let pixelBuffer = new Uint8Array(0);
const FRAME_SIZE = 1280 * 720 * 3;

function log(msg) {
  const p = document.createElement('div');
  p.className = 'log-entry';
  p.innerText = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${msg}`;
  logConsole.prepend(p);
}

// === 1. AES-256 DECRYPTION SETUP ===
const RAW_KEY = new TextEncoder().encode("GHOST_PROTOCOL_SECRET_KEY_32BYTE");
const NONCE = new TextEncoder().encode("unique_nonce"); // 12 bytes

async function initCrypto() {
  return await crypto.subtle.importKey(
    "raw", RAW_KEY, "AES-GCM", false, ["decrypt"]
  );
}

let cryptoKey;
initCrypto().then(key => { cryptoKey = key; log("> CRYPTO_KEY ESTABLISHED."); });

// === 2. WEBSOCKET HANDLING ===
socket.onopen = () => {
  statusText.innerText = "> LISTENING ON SECURE FREQUENCY...";
  statusText.style.color = "#0f0";
  log("WebSocket Connected.");
};

socket.onclose = () => {
  statusText.innerText = "> SIGNAL LOST.";
  statusText.style.color = "#f00";
  statusText.classList.remove("blink");
};

socket.onmessage = (event) => {
  const chunk = new Uint8Array(event.data);

  // 1. Draw the Decoy Video
  renderVideoFrame(chunk);

  // 2. Extract the hidden LSB Payload
  if (extracting) extractLSB(chunk);
};

// === 3. VISUALIZER ENGINE ===
function renderVideoFrame(chunk) {
  // Append to buffer
  const newBuf = new Uint8Array(pixelBuffer.length + chunk.length);
  newBuf.set(pixelBuffer);
  newBuf.set(chunk, pixelBuffer.length);
  pixelBuffer = newBuf;

  // If we have a full 720p frame, draw it
  if (pixelBuffer.length >= FRAME_SIZE) {
    let framePixels = pixelBuffer.slice(0, FRAME_SIZE);
    pixelBuffer = pixelBuffer.slice(FRAME_SIZE); // Keep the rest

    // Convert RGB to RGBA for Canvas
    for (let i = 0, j = 0; i < framePixels.length; i += 3, j += 4) {
      imgData.data[j] = framePixels[i];       // R
      imgData.data[j + 1] = framePixels[i + 1];   // G
      imgData.data[j + 2] = framePixels[i + 2];   // B
      imgData.data[j + 3] = 255;                // Alpha
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

// === 4. LSB DEMODULATOR ===
function extractLSB(chunk) {
  for (let i = 0; i < chunk.length; i++) {
    if (!extracting) return;

    // Rip the Least Significant Bit from the pixel
    const bit = chunk[i] & 1;

    // Shift bit into our reconstructed byte
    currentByte = (currentByte << 1) | bit;
    bitCursor++;

    if (bitCursor === 8) {
      extractedBytes.push(currentByte);
      currentByte = 0;
      bitCursor = 0;

      // Step A: Determine Payload Size (First 4 bytes)
      if (encryptedSize === null && extractedBytes.length === 4) {
        const view = new DataView(new Uint8Array(extractedBytes).buffer);
        encryptedSize = view.getUint32(0); // Big Endian
        log(`> INCOMING ENCRYPTED PAYLOAD: ${encryptedSize} bytes`);
      }

      // Step B: Collect Payload
      if (encryptedSize !== null && extractedBytes.length === 4 + encryptedSize) {
        extracting = false;
        log("> EXTRACTION COMPLETE. ATTEMPTING DECRYPTION...");
        const cipherText = new Uint8Array(extractedBytes.slice(4));
        decryptAndUnpack(cipherText);
      }
    }
  }
}

// === 5. DECRYPTION & METADATA PARSING ===
async function decryptAndUnpack(cipherText) {
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: NONCE },
      cryptoKey,
      cipherText
    );

    const decArray = new Uint8Array(decryptedBuffer);
    const view = new DataView(decArray.buffer);

    // Parse the inner header: [4: NameLen] [Name] [8: FileLen] [FileData]
    const nameLen = view.getUint32(0);
    const nameBytes = decArray.slice(4, 4 + nameLen);
    const fileName = new TextDecoder().decode(nameBytes);
    const fileData = decArray.slice(4 + nameLen + 8); // Skip the 8-byte length

    log(`> DECRYPTION SUCCESSFUL: [${fileName}]`);
    triggerSelfDestruct(fileName, fileData);

  } catch (e) {
    log("> DECRYPTION FAILED. UNAUTHORIZED INTERCEPT.");
    console.error(e);
  }
}

// === 6. BURN AFTER READING SEQUENCE ===
function triggerSelfDestruct(fileName, fileData) {
  extractionZone.classList.remove('hidden');

  let timeLeft = 15.00;

  // Assign Download action
  downloadBtn.onclick = () => {
    const blob = new Blob([fileData], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    log(`> PAYLOAD [${fileName}] EXTRACTED SECURELY.`);
  };

  // Self-Destruct Timer
  const countdown = setInterval(() => {
    timeLeft -= 0.05;
    timerText.innerText = `TIME TO DELETION: ${timeLeft.toFixed(2)}s`;

    if (timeLeft <= 0) {
      clearInterval(countdown);
      timerText.innerText = ">> TRACE ERASED <<";

      // WIPE THE MEMORY
      fileData.fill(0);
      extractedBytes = [];

      downloadBtn.classList.add('hidden');
      log("> MEMORY PURGED. FILE DESTROYED.");
    }
  }, 50);
}