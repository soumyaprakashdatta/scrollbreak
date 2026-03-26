const extensionApi = globalThis.browser ?? globalThis.chrome;

const DEFAULT_USAGE_MINUTES = 15;
const DEFAULT_BLOCK_MINUTES = 5;

const BUILTIN_SITES = [
  { id: "facebook", label: "Facebook", patterns: ["facebook.com"], enabled: true, builtin: true },
  { id: "instagram", label: "Instagram", patterns: ["instagram.com"], enabled: true, builtin: true },
  { id: "x", label: "X", patterns: ["x.com", "twitter.com"], enabled: true, builtin: true },
  { id: "youtube", label: "YouTube", patterns: ["youtube.com", "youtu.be"], enabled: true, builtin: true }
];

const STORAGE_KEYS = {
  settings: "settings",
  state: "state"
};

function createDefaultSettings() {
  return {
    maxUsageMinutes: DEFAULT_USAGE_MINUTES,
    blockDurationMinutes: DEFAULT_BLOCK_MINUTES,
    sites: BUILTIN_SITES
  };
}

function createDefaultState() {
  return {
    usageBySite: {},
    blocksBySite: {},
    pause: {
      isPaused: false,
      startedAt: 0
    }
  };
}

async function getStoredData(keys) {
  return extensionApi.storage.local.get(keys);
}

async function setStoredData(data) {
  return extensionApi.storage.local.set(data);
}

function sanitizeMinutes(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(numeric * 10) / 10, 0.1), 24 * 60);
}

function normalizePattern(pattern) {
  return String(pattern || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "");
}

function normalizeSite(site, index) {
  const patterns = Array.from(
    new Set(
      (site.patterns || [])
        .map(normalizePattern)
        .filter(Boolean)
    )
  );

  return {
    id: String(site.id || `custom-${index}`),
    label: String(site.label || patterns[0] || `Site ${index + 1}`).trim(),
    patterns,
    enabled: Boolean(site.enabled),
    builtin: Boolean(site.builtin)
  };
}

function sanitizeSettings(settings) {
  const fallback = createDefaultSettings();
  const incomingSites = Array.isArray(settings?.sites) ? settings.sites : fallback.sites;
  const sites = incomingSites
    .map(normalizeSite)
    .filter((site) => site.label && site.patterns.length > 0);

  return {
    maxUsageMinutes: sanitizeMinutes(settings?.maxUsageMinutes, fallback.maxUsageMinutes),
    blockDurationMinutes: sanitizeMinutes(settings?.blockDurationMinutes, fallback.blockDurationMinutes),
    sites: sites.length ? sites : fallback.sites
  };
}

function sanitizeState(state) {
  const fallback = createDefaultState();
  const usageBySite = state && typeof state.usageBySite === "object" ? state.usageBySite : fallback.usageBySite;
  const blocksBySite = state && typeof state.blocksBySite === "object" ? state.blocksBySite : fallback.blocksBySite;
  const pauseState = state && typeof state.pause === "object" ? state.pause : fallback.pause;

  return {
    usageBySite,
    blocksBySite,
    pause: {
      isPaused: Boolean(pauseState.isPaused),
      startedAt: Math.max(0, Number(pauseState.startedAt || 0))
    }
  };
}

async function ensureData() {
  const stored = await getStoredData([STORAGE_KEYS.settings, STORAGE_KEYS.state]);
  const settings = sanitizeSettings(stored[STORAGE_KEYS.settings] || createDefaultSettings());
  const state = sanitizeState(stored[STORAGE_KEYS.state] || createDefaultState());
  const shouldPersistSettings = !stored[STORAGE_KEYS.settings];
  const shouldPersistState = !stored[STORAGE_KEYS.state]
    || Boolean(stored[STORAGE_KEYS.state]?.pause === undefined);

  if (shouldPersistSettings || shouldPersistState) {
    await setStoredData({
      [STORAGE_KEYS.settings]: settings,
      [STORAGE_KEYS.state]: state
    });
  }

  return { settings, state };
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function siteMatchesHostname(site, hostname) {
  return site.patterns.some((pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`));
}

function findTrackedSite(settings, url) {
  const hostname = hostnameFromUrl(url);
  if (!hostname) {
    return null;
  }

  return settings.sites.find((site) => site.enabled && siteMatchesHostname(site, hostname)) || null;
}

function getSiteSnapshot(settings, state, siteId, now) {
  const usageMs = Math.max(0, Number(state.usageBySite?.[siteId]?.usedMs || 0));
  const blockedUntil = Math.max(0, Number(state.blocksBySite?.[siteId]?.blockedUntil || 0));
  const isBlocked = blockedUntil > now;
  const maxUsageMs = settings.maxUsageMinutes * 60 * 1000;
  const blockDurationMs = settings.blockDurationMinutes * 60 * 1000;

  return {
    usageMs,
    blockedUntil,
    isBlocked,
    maxUsageMs,
    blockDurationMs,
    remainingUsageMs: Math.max(0, maxUsageMs - usageMs),
    remainingBlockMs: Math.max(0, blockedUntil - now)
  };
}

async function getSettingsAndState() {
  const stored = await getStoredData([STORAGE_KEYS.settings, STORAGE_KEYS.state]);
  return {
    settings: sanitizeSettings(stored[STORAGE_KEYS.settings] || createDefaultSettings()),
    state: sanitizeState(stored[STORAGE_KEYS.state] || createDefaultState())
  };
}

async function saveState(state) {
  await setStoredData({ [STORAGE_KEYS.state]: state });
}

function withExpiredBlocksCleared(state, now) {
  const cleanState = structuredClone(state);
  let changed = false;

  for (const [siteId, entry] of Object.entries(cleanState.blocksBySite || {})) {
    const blockedUntil = Math.max(0, Number(entry?.blockedUntil || 0));
    if (blockedUntil && blockedUntil <= now) {
      delete cleanState.blocksBySite[siteId];
      changed = true;
    }
  }

  return { state: cleanState, changed };
}

function getPausedSiteSnapshot(settings, state, siteId) {
  const snapshot = getSiteSnapshot(settings, state, siteId, Math.max(0, Number(state.pause.startedAt || Date.now())));
  return {
    ...snapshot,
    isBlocked: false
  };
}

async function handleTogglePause(forcePaused) {
  const now = Date.now();
  const { state } = await getSettingsAndState();
  const nextState = structuredClone(state);
  const shouldPause = typeof forcePaused === "boolean"
    ? forcePaused
    : !nextState.pause.isPaused;

  if (shouldPause === nextState.pause.isPaused) {
    return { ok: true, paused: nextState.pause.isPaused };
  }

  if (shouldPause) {
    nextState.pause = {
      isPaused: true,
      startedAt: now
    };
  } else {
    const pauseDurationMs = Math.max(0, now - Number(nextState.pause.startedAt || 0));
    for (const entry of Object.values(nextState.blocksBySite || {})) {
      const blockedUntil = Math.max(0, Number(entry?.blockedUntil || 0));
      if (blockedUntil > Number(nextState.pause.startedAt || 0)) {
        entry.blockedUntil = blockedUntil + pauseDurationMs;
      }
    }

    nextState.pause = {
      isPaused: false,
      startedAt: 0
    };
  }

  await saveState(nextState);

  return {
    ok: true,
    paused: nextState.pause.isPaused
  };
}

async function handleHeartbeat({ url, elapsedMs = 1000 }) {
  const now = Date.now();
  const { settings, state } = await getSettingsAndState();
  const site = findTrackedSite(settings, url);

  if (!site) {
    return { tracked: false, paused: state.pause.isPaused };
  }

  if (state.pause.isPaused) {
    return {
      tracked: true,
      paused: true,
      site,
      ...getPausedSiteSnapshot(settings, state, site.id)
    };
  }

  const { state: cleanState } = withExpiredBlocksCleared(state, now);

  const snapshotBefore = getSiteSnapshot(settings, cleanState, site.id, now);

  if (snapshotBefore.isBlocked) {
    await saveState(cleanState);
    return {
      tracked: true,
      site,
      ...snapshotBefore
    };
  }

  const boundedElapsed = Math.max(250, Math.min(Number(elapsedMs) || 1000, 5000));
  const usageEntry = cleanState.usageBySite[site.id] || { usedMs: 0 };
  usageEntry.usedMs = Math.max(0, Number(usageEntry.usedMs || 0)) + boundedElapsed;
  cleanState.usageBySite[site.id] = usageEntry;

  let snapshotAfter = getSiteSnapshot(settings, cleanState, site.id, now);

  if (usageEntry.usedMs >= snapshotAfter.maxUsageMs) {
    cleanState.blocksBySite[site.id] = { blockedUntil: now + snapshotAfter.blockDurationMs };
    cleanState.usageBySite[site.id] = { usedMs: 0 };
    snapshotAfter = getSiteSnapshot(settings, cleanState, site.id, now);
  }

  await saveState(cleanState);

  return {
    tracked: true,
    paused: false,
    site,
    ...snapshotAfter
  };
}

async function handleGetSiteState(url) {
  const now = Date.now();
  const { settings, state } = await getSettingsAndState();
  const site = findTrackedSite(settings, url);

  if (!site) {
    return { tracked: false, paused: state.pause.isPaused };
  }

  if (state.pause.isPaused) {
    return {
      tracked: true,
      paused: true,
      site,
      ...getPausedSiteSnapshot(settings, state, site.id)
    };
  }

  const { state: cleanState, changed } = withExpiredBlocksCleared(state, now);

  if (changed) {
    await saveState(cleanState);
  }

  return {
    tracked: true,
    paused: false,
    site,
    ...getSiteSnapshot(settings, cleanState, site.id, now)
  };
}

async function handleGetDashboardData(activeUrl) {
  const now = Date.now();
  const { settings, state } = await getSettingsAndState();
  const activeState = state.pause.isPaused ? state : withExpiredBlocksCleared(state, now).state;
  const sites = settings.sites.map((site) => {
    const snapshot = state.pause.isPaused
      ? getPausedSiteSnapshot(settings, state, site.id)
      : getSiteSnapshot(settings, activeState, site.id, now);
    return {
      ...site,
      ...snapshot
    };
  });

  return {
    settings,
    sites,
    activeSiteId: findTrackedSite(settings, activeUrl)?.id || null,
    pause: {
      isPaused: state.pause.isPaused
    }
  };
}

extensionApi.runtime.onInstalled.addListener(() => {
  ensureData();
});

extensionApi.runtime.onStartup.addListener(() => {
  ensureData();
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "get-settings") {
      const { settings } = await getSettingsAndState();
      sendResponse({ settings });
      return;
    }

    if (message?.type === "save-settings") {
      const nextSettings = sanitizeSettings(message.settings);
      const { state } = await getSettingsAndState();
      await setStoredData({
        [STORAGE_KEYS.settings]: nextSettings,
        [STORAGE_KEYS.state]: {
          ...createDefaultState(),
          pause: state.pause
        }
      });
      sendResponse({ ok: true, settings: nextSettings });
      return;
    }

    if (message?.type === "heartbeat") {
      sendResponse(await handleHeartbeat(message));
      return;
    }

    if (message?.type === "get-site-state") {
      sendResponse(await handleGetSiteState(message.url));
      return;
    }

    if (message?.type === "get-dashboard-data") {
      sendResponse(await handleGetDashboardData(message.activeUrl));
      return;
    }

    if (message?.type === "toggle-pause") {
      sendResponse(await handleTogglePause(message.paused));
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })().catch((error) => {
    console.error("ScrollBrake message handling failed", error);
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
