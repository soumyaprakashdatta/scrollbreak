const extensionApi = globalThis.browser ?? globalThis.chrome;

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
        align-items: stretch;
        justify-content: stretch;
        background:
          radial-gradient(circle at top, rgba(255, 203, 107, 0.24), transparent 26%),
          radial-gradient(circle at bottom right, rgba(73, 166, 255, 0.2), transparent 24%),
          linear-gradient(180deg, rgba(7, 10, 18, 0.96), rgba(10, 14, 24, 0.98));
        backdrop-filter: blur(18px);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: #f5f7fb;
      }

      #${OVERLAY_ID} * {
        box-sizing: border-box;
      }

      #${OVERLAY_ID} .social-lock-screen {
        display: grid;
        grid-template-rows: auto 1fr auto;
        width: 100%;
        min-height: 100vh;
        padding: clamp(20px, 4vw, 44px);
      }

      #${OVERLAY_ID} .social-lock-topbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }

      #${OVERLAY_ID} .social-lock-brand {
        max-width: 280px;
      }

      #${OVERLAY_ID} .social-lock-brand strong {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(245, 247, 251, 0.72);
      }

      #${OVERLAY_ID} .social-lock-brand span {
        font-size: 14px;
        line-height: 1.5;
        color: rgba(245, 247, 251, 0.62);
      }

      #${OVERLAY_ID} .social-lock-stage {
        display: grid;
        align-content: center;
        width: min(960px, 100%);
        margin: 0 auto;
        padding: 24px 0;
      }

      #${OVERLAY_ID} .eyebrow {
        display: inline-flex;
        margin-bottom: 20px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #08111c;
        background: linear-gradient(135deg, #ffd36d, #ff9a5a);
      }

      #${OVERLAY_ID} h1 {
        margin: 0 0 18px;
        max-width: 10ch;
        font-size: clamp(48px, 9vw, 116px);
        line-height: 0.94;
        letter-spacing: -0.06em;
      }

      #${OVERLAY_ID} p {
        margin: 0;
        max-width: 720px;
        font-size: clamp(18px, 2vw, 24px);
        line-height: 1.6;
        color: rgba(245, 247, 251, 0.82);
      }

      #${OVERLAY_ID} .countdown {
        margin: 34px 0 20px;
        font-size: clamp(64px, 16vw, 180px);
        line-height: 0.88;
        font-weight: 700;
        letter-spacing: -0.05em;
      }

      #${OVERLAY_ID} .meter {
        width: 100%;
        height: 12px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      }

      #${OVERLAY_ID} .meter-fill {
        height: 100%;
        width: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ffd36d, #ff8f6b, #5cc8ff);
      }

      #${OVERLAY_ID} .footer {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin-top: 20px;
        font-size: 14px;
        color: rgba(245, 247, 251, 0.6);
      }

      #${OVERLAY_ID} .footer-note {
        max-width: 520px;
      }

      #${OVERLAY_ID} .footer-tag {
        white-space: nowrap;
        color: rgba(245, 247, 251, 0.42);
      }

      @media (max-width: 720px) {
        #${OVERLAY_ID} .social-lock-screen {
          padding: 20px;
        }

        #${OVERLAY_ID} .social-lock-topbar,
        #${OVERLAY_ID} .footer {
          flex-direction: column;
          align-items: flex-start;
        }

        #${OVERLAY_ID} h1 {
          max-width: none;
          font-size: clamp(40px, 15vw, 74px);
        }

        #${OVERLAY_ID} .countdown {
          font-size: clamp(56px, 22vw, 112px);
        }
      }
    </style>
    <div class="social-lock-screen" role="dialog" aria-modal="true" aria-live="polite">
      <div class="social-lock-topbar">
        <div class="social-lock-brand">
          <strong>ScrollBrake</strong>
          <span>Focus mode is active. This break timer is stored locally on your device.</span>
        </div>
        <div class="eyebrow">Locked</div>
      </div>
      <div class="social-lock-stage">
        <h1 id="social-lock-title">Time for a quick reset</h1>
        <p id="social-lock-message">This site is temporarily locked. You can come back when the countdown ends.</p>
        <div class="countdown" id="social-lock-countdown">1:00</div>
        <div class="meter" aria-hidden="true">
          <div class="meter-fill" id="social-lock-meter"></div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-note" id="social-lock-footer">ScrollBrake keeps your settings and timers on this device only.</div>
        <div class="footer-tag">Take a short break, then jump back in.</div>
      </div>
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
    const fresh = await extensionApi.runtime.sendMessage({ type: "get-site-state", url: getPageUrl() });
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

  const response = await extensionApi.runtime.sendMessage({
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
  const response = await extensionApi.runtime.sendMessage({
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
