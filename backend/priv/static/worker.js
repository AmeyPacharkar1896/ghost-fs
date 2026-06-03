// worker.js

// === STATE ===
let scannerState = 'SCANNING';
let bitCursor = 0;
let currentByte = 0;

let winHigh = 0;
let winLow = 0;

let encryptedSize = null;
let headerBuffer = new Uint8Array(4);
let headerIndex = 0;
let payloadBuffer = null;
let payloadIndex = 0;

// === CRYPTO SETUP ===
const RAW_KEY = new TextEncoder().encode("GHOST_PROTOCOL_SECRET_KEY_32BYTE");
const NONCE = new TextEncoder().encode("unique_nonce");
let cryptoKey;

crypto.subtle.importKey("raw", RAW_KEY, "AES-GCM", false, ["decrypt"])
  .then(key => {
    cryptoKey = key;
    postMessage({ type: 'log', msg: "> CRYPTO_KEY ESTABLISHED IN BACKGROUND THREAD." });
  });

// === INCOMING CHUNK PROCESSOR ===
self.onmessage = (event) => {
  const chunk = event.data;

  for (let i = 0; i < chunk.length; i++) {
    if (scannerState === 'DONE') continue;

    const bit = chunk[i] & 1;

    if (scannerState === 'SCANNING') {
      winHigh = ((winHigh << 1) | (winLow >>> 31)) & 0xFF;
      winLow = ((winLow << 1) | bit) >>> 0;

      if (winHigh === 0x47 && winLow === 0x484F5354) {
        postMessage({ type: 'log', msg: "> MAGIC SIGNATURE DETECTED. SIGNAL LOCKED." });
        scannerState = 'READING_HEADER';
        bitCursor = 0;
        currentByte = 0;
        headerIndex = 0;
      }
      continue;
    }

    currentByte = ((currentByte << 1) | bit) & 0xFF;
    bitCursor++;

    if (bitCursor === 8) {
      if (scannerState === 'READING_HEADER') {
        headerBuffer[headerIndex++] = currentByte;

        if (headerIndex === 4) {
          encryptedSize = new DataView(headerBuffer.buffer).getUint32(0);
          postMessage({ type: 'log', msg: `> INCOMING ENCRYPTED PAYLOAD: ${encryptedSize} bytes` });

          payloadBuffer = new Uint8Array(encryptedSize);
          payloadIndex = 0;
          scannerState = 'EXTRACTING';
        }
      }
      else if (scannerState === 'EXTRACTING') {
        payloadBuffer[payloadIndex++] = currentByte;

        if (payloadIndex === encryptedSize) {
          scannerState = 'DONE';
          postMessage({ type: 'log', msg: "> EXTRACTION COMPLETE. ATTEMPTING DECRYPTION..." });

          // 1. Kick off decryption asynchronously
          decryptAndUnpack(payloadBuffer);

          // 2. INSTANTLY reset the scanner for the next drop
          scannerState = 'SCANNING';
          winHigh = 0;
          winLow = 0;
          payloadBuffer = null; // Free the memory immediately

          postMessage({ type: 'log', msg: "> SCANNER RESET. LISTENING FOR NEXT DROP." });
        }
      }

      currentByte = 0;
      bitCursor = 0;
    }
  }
};

// === DECRYPTION ===
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

    // Kept your original slicing offset intact
    const fileData = decArray.slice(4 + nameLen + 8);

    postMessage({ type: 'log', msg: `> DECRYPTION SUCCESSFUL: [${fileName}]` });

    // Send back to Main Thread for UI trigger
    postMessage({ type: 'extracted', fileName, fileData });

  } catch (e) {
    postMessage({ type: 'log', msg: "> DECRYPTION FAILED. UNAUTHORIZED INTERCEPT." });
    console.error(e);
  }
}