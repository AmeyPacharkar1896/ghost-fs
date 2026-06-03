const tunerOverlay = document.getElementById('tuner-overlay');
const freqInput = document.getElementById('freq-input');
const tuneBtn = document.getElementById('tune-btn');
const statusText = document.getElementById('status');
const canvas = document.getElementById('feed');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const imgData = ctx.createImageData(1280, 720);

const extractionZone = document.getElementById('extraction-zone');
const timerText = document.getElementById('timer');
const downloadBtn = document.getElementById('download-btn');
const logConsole = document.getElementById('log-console');

// NEW UI ELEMENTS
const deadSignalOverlay = document.getElementById('dead-signal-overlay');
const retuneBtn = document.getElementById('retune-btn');

let socket = null;
let currentCountdown = null;

const FRAME_SIZE = 1280 * 720 * 3;
const frameBuffer = new Uint8Array(FRAME_SIZE);
const canvasView32 = new Uint32Array(imgData.data.buffer);
let frameIndex = 0;

function log(msg) {
  const p = document.createElement('div');
  p.className = 'log-entry';
  p.innerText = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${msg}`;
  logConsole.prepend(p);
}

const demodulatorWorker = new Worker('worker.js');

demodulatorWorker.onmessage = (e) => {
  const { type, msg, fileName, fileData } = e.data;
  if (type === 'log') log(msg);
  else if (type === 'extracted') triggerSelfDestruct(fileName, fileData);
};

// === WEBSOCKET & RENDERING ===
tuneBtn.onclick = () => {
  const freq = freqInput.value.trim();
  if (!freq) return;

  tunerOverlay.style.display = 'none';
  deadSignalOverlay.classList.add('hidden');
  extractionZone.classList.add('hidden');

  statusText.innerText = `> TUNING TO ${freq}...`;
  statusText.style.color = "#0f0";
  statusText.classList.add("blink");

  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();

  socket = new WebSocket(`ws://127.0.0.1:4000/socket?freq=${freq}`);
  socket.binaryType = 'arraybuffer';

  socket.onopen = () => {
    statusText.innerText = `> SIGNAL LOCKED ON FREQ ${freq}`;
    statusText.classList.remove("blink");
    log(`> WebSocket Connected to ${freq}.`);
    frameIndex = 0; // Reset video alignment
  };

  socket.onclose = () => {
    log("> WARNING: SIGNAL SEVERED BY HOST. FREQUENCY BURNED.");
    statusText.innerText = "> SIGNAL LOST. TRACE ERASED.";
    statusText.style.color = "#f00";
    statusText.classList.remove("blink");

    // BRUTALLY BLACKOUT CANVAS
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // TRIGGER SCORCHED EARTH OVERLAY
    deadSignalOverlay.classList.remove('hidden');
  };

  socket.onerror = () => log("> ERROR: INTERFERENCE DETECTED ON CHANNEL.");

  socket.onmessage = (event) => {
    const chunk = new Uint8Array(event.data);
    demodulatorWorker.postMessage(chunk);
    renderVisualizer(chunk);
  };
};

// === RETUNE LOGIC ===
retuneBtn.onclick = () => {
  deadSignalOverlay.classList.add('hidden');
  freqInput.value = '';
  tunerOverlay.style.display = 'flex';
  freqInput.focus();
};

function renderVisualizer(chunk) {
  for (let i = 0; i < chunk.length; i++) {
    frameBuffer[frameIndex++] = chunk[i];
    if (frameIndex === FRAME_SIZE) {
      for (let px = 0, px32 = 0; px < FRAME_SIZE; px += 3, px32++) {
        canvasView32[px32] = (0xFF000000) | (frameBuffer[px + 2] << 16) | (frameBuffer[px + 1] << 8) | (frameBuffer[px]);
      }
      ctx.putImageData(imgData, 0, 0);
      frameIndex = 0;
    }
  }
}

function triggerSelfDestruct(fileName, fileData) {
  extractionZone.classList.remove('hidden');
  downloadBtn.classList.remove('hidden');
  let timeLeft = 15.00;
  if (currentCountdown) clearInterval(currentCountdown);

  downloadBtn.onclick = () => {
    const blob = new Blob([fileData], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    log(`> PAYLOAD [${fileName}] EXTRACTED SECURELY.`);
  };

  currentCountdown = setInterval(() => {
    timeLeft -= 0.05;
    timerText.innerText = `TIME TO DELETION: ${timeLeft.toFixed(2)}s`;
    if (timeLeft <= 0) {
      clearInterval(currentCountdown);
      timerText.innerText = ">> TRACE ERASED <<";
      if (fileData && fileData.fill) fileData.fill(0);
      downloadBtn.classList.add('hidden');
      log("> MEMORY PURGED. FILE DESTROYED.");
    }
  }, 50);
}