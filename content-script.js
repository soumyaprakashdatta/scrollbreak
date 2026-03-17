const HEARTBEAT_MS = 1000;
const OVERLAY_ID = "social-lock-overlay-root";

let overlayRoot = null;
let overlayIntervalId = null;
let heartbeatIntervalId = null;
let lastHeartbeatAt = Date.now();

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getPageUrl() {
  return window.location.href;
}

function ensureOverlay() {
  if (overlayRoot) {
    return overlayRoot;
  }

  overlayRoot = document.createElement("div");
  overlayRoot.id = OVERLAY_ID;
  overlayRoot.style.display = "none";
  overlayRoot.innerHTML = `
    <style>
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(255, 203, 107, 0.28), transparent 28%),
          radial-gradient(circle at bottom right, rgba(73, 166, 255, 0.22), transparent 24%),
          rgba(10, 14, 24, 0.9);
        backdrop-filter: blur(14px);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }

      #${OVERLAY_ID} * {
        box-sizing: border-box;
      }

      #${OVERLAY_ID} .social-lock-card {
        width: min(480px, 100%);
        padding: 32px;
        border-radius: 28px;
        color: #f5f7fb;
        background: linear-gradient(180deg, rgba(22, 29, 46, 0.96), rgba(9, 12, 20, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
      }

      #${OVERLAY_ID} .eyebrow {
        display: inline-flex;
        margin-bottom: 16px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #08111c;
        background: linear-gradient(135deg, #ffd36d, #ff9a5a);
      }

      #${OVERLAY_ID} h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1;
      }

      #${OVERLAY_ID} p {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
        color: rgba(245, 247, 251, 0.82);
      }

      #${OVERLAY_ID} .countdown {
        margin: 28px 0 18px;
        font-size: clamp(44px, 14vw, 84px);
        line-height: 1;
        font-weight: 700;
        letter-spacing: -0.05em;
      }

      #${OVERLAY_ID} .meter {
        height: 12px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
      }

      #${OVERLAY_ID} .meter-fill {
        height: 100%;
        width: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ffd36d, #ff8f6b, #5cc8ff);
      }

      #${OVERLAY_ID} .footer {
        margin-top: 18px;
        font-size: 14px;
        color: rgba(245, 247, 251, 0.6);
      }
    </style>
    <div class="social-lock-card" role="dialog" aria-modal="true" aria-live="polite">
      <div class="eyebrow">Focus mode</div>
      <h1 id="social-lock-title">Time for a quick reset</h1>
      <p id="social-lock-message">This site is temporarily locked. You can come back when the countdown ends.</p>
      <div class="countdown" id="social-lock-countdown">1:00</div>
      <div class="meter" aria-hidden="true">
        <div class="meter-fill" id="social-lock-meter"></div>
      </div>
      <div class="footer" id="social-lock-footer">ScrollBrake keeps your settings and timers on this device only.</div>
    </div>
  `;

  const append = () => {
    if (!document.documentElement.contains(overlayRoot)) {
      document.documentElement.appendChild(overlayRoot);
    }
  };

  append();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", append, { once: true });
  }

  return overlayRoot;
}

function showOverlay(snapshot) {
  const root = ensureOverlay();
  const title = root.querySelector("#social-lock-title");
  const message = root.querySelector("#social-lock-message");
  const countdown = root.querySelector("#social-lock-countdown");
  const meter = root.querySelector("#social-lock-meter");

  root.style.display = "flex";
  title.textContent = `${snapshot.site.label} is locked`;
  message.textContent = "Your usage limit has been reached. Take a short break while the timer counts down.";
  countdown.textContent = formatDuration(snapshot.remainingBlockMs);

  const progress = snapshot.blockDurationMs > 0
    ? ((snapshot.blockDurationMs - snapshot.remainingBlockMs) / snapshot.blockDurationMs) * 100
    : 100;
  meter.style.width = `${Math.max(0, Math.min(progress, 100))}%`;

  if (overlayIntervalId) {
    window.clearInterval(overlayIntervalId);
  }

  overlayIntervalId = window.setInterval(async () => {
    const fresh = await chrome.runtime.sendMessage({ type: "get-site-state", url: getPageUrl() });
    if (!fresh?.tracked || !fresh?.isBlocked) {
      hideOverlay();
      return;
    }

    countdown.textContent = formatDuration(fresh.remainingBlockMs);
    const nextProgress = fresh.blockDurationMs > 0
      ? ((fresh.blockDurationMs - fresh.remainingBlockMs) / fresh.blockDurationMs) * 100
      : 100;
    meter.style.width = `${Math.max(0, Math.min(nextProgress, 100))}%`;
  }, 250);
}

function hideOverlay() {
  if (overlayRoot) {
    overlayRoot.style.display = "none";
  }
  if (overlayIntervalId) {
    window.clearInterval(overlayIntervalId);
    overlayIntervalId = null;
  }
}

function shouldTrackNow() {
  return document.visibilityState === "visible" && document.hasFocus();
}

async function sendHeartbeat() {
  if (!shouldTrackNow()) {
    lastHeartbeatAt = Date.now();
    return;
  }

  const now = Date.now();
  const elapsedMs = now - lastHeartbeatAt;
  lastHeartbeatAt = now;

  const response = await chrome.runtime.sendMessage({
    type: "heartbeat",
    url: getPageUrl(),
    elapsedMs
  }).catch(() => null);

  if (response?.tracked && response.isBlocked) {
    showOverlay(response);
  } else {
    hideOverlay();
  }
}

async function checkImmediateState() {
  lastHeartbeatAt = Date.now();
  const response = await chrome.runtime.sendMessage({
    type: "get-site-state",
    url: getPageUrl()
  }).catch(() => null);

  if (response?.tracked && response.isBlocked) {
    showOverlay(response);
  } else {
    hideOverlay();
  }
}

function startHeartbeatLoop() {
  if (heartbeatIntervalId) {
    return;
  }

  heartbeatIntervalId = window.setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_MS);
}

function boot() {
  startHeartbeatLoop();
  checkImmediateState();

  document.addEventListener("visibilitychange", () => {
    checkImmediateState();
  });

  window.addEventListener("focus", () => {
    checkImmediateState();
  });

  window.addEventListener("blur", () => {
    lastHeartbeatAt = Date.now();
  });
}

boot();
