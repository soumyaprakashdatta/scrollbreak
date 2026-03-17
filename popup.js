const extensionApi = globalThis.browser ?? globalThis.chrome;

const DEFAULTS = {
  maxUsageMinutes: 15,
  blockDurationMinutes: 1
};

const elements = {
  form: document.querySelector("#settings-form"),
  maxUsageMinutes: document.querySelector("#max-usage-minutes"),
  blockDurationMinutes: document.querySelector("#block-duration-minutes"),
  siteList: document.querySelector("#site-list"),
  customSiteForm: document.querySelector("#custom-site-form"),
  customSiteDomain: document.querySelector("#custom-site-domain"),
  statusMessage: document.querySelector("#status-message"),
  saveButton: document.querySelector("#save-button"),
  openOptionsButton: document.querySelector("#open-options-button"),
  activeSiteChip: document.querySelector("#active-site-chip")
};

let dashboardData = null;

function normalizePattern(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "");
}

function createCustomSite(domain) {
  const pattern = normalizePattern(domain);
  const label = pattern
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(".");

  return {
    id: `custom-${Date.now()}`,
    label,
    patterns: [pattern],
    enabled: true,
    builtin: false
  };
}

function formatDuration(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes >= 1) {
    return `${totalMinutes} min left`;
  }
  return `${Math.ceil(ms / 1000)} sec left`;
}

function showStatus(message, kind = "") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${kind}`.trim();
}

function activeUrl() {
  return extensionApi.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => tabs[0]?.url || "");
}

function renderSiteList() {
  const sites = dashboardData?.settings?.sites || [];
  const statsById = new Map((dashboardData?.sites || []).map((site) => [site.id, site]));

  elements.siteList.innerHTML = "";

  for (const site of sites) {
    const stats = statsById.get(site.id);
    const usageRatio = stats?.maxUsageMs ? Math.min((stats.usageMs / stats.maxUsageMs) * 100, 100) : 0;
    const stateLabel = stats?.isBlocked
      ? formatDuration(stats.remainingBlockMs)
      : `${Math.max(0, Math.ceil((stats?.remainingUsageMs || 0) / 60000))} min available`;

    const card = document.createElement("article");
    card.className = "site-card";
    card.innerHTML = `
      <input class="site-toggle" type="checkbox" ${site.enabled ? "checked" : ""} aria-label="Toggle ${site.label}" />
      <div>
        <h3>${site.label}</h3>
        <p>${site.patterns.join(", ")}</p>
      </div>
      <div class="site-actions">
        <div class="site-metric">
          <strong>${stats?.isBlocked ? "Locked" : "Ready"}</strong>
          <span>${stateLabel}</span>
          <div class="site-meter"><span style="width:${usageRatio}%;"></span></div>
        </div>
      </div>
    `;

    const toggle = card.querySelector(".site-toggle");
    toggle.addEventListener("change", () => {
      site.enabled = toggle.checked;
    });

    if (!site.builtin) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "text-button site-remove";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        dashboardData.settings.sites = dashboardData.settings.sites.filter((entry) => entry.id !== site.id);
        renderSiteList();
      });
      card.querySelector(".site-actions").appendChild(removeButton);
    }

    elements.siteList.appendChild(card);
  }
}

async function loadDashboard() {
  const url = await activeUrl();
  dashboardData = await extensionApi.runtime.sendMessage({ type: "get-dashboard-data", activeUrl: url });
  elements.maxUsageMinutes.value = dashboardData.settings.maxUsageMinutes || DEFAULTS.maxUsageMinutes;
  elements.blockDurationMinutes.value = dashboardData.settings.blockDurationMinutes || DEFAULTS.blockDurationMinutes;
  const activeSite = dashboardData.sites.find((site) => site.id === dashboardData.activeSiteId);
  elements.activeSiteChip.textContent = activeSite ? `Active: ${activeSite.label}` : "No tracked site open";
  renderSiteList();
}

function collectSettings() {
  return {
    maxUsageMinutes: Number(elements.maxUsageMinutes.value) || DEFAULTS.maxUsageMinutes,
    blockDurationMinutes: Number(elements.blockDurationMinutes.value) || DEFAULTS.blockDurationMinutes,
    sites: dashboardData.settings.sites.map((site) => ({
      ...site,
      patterns: site.patterns.map(normalizePattern).filter(Boolean)
    }))
  };
}

async function saveSettings() {
  const settings = collectSettings();
  if (settings.maxUsageMinutes < 1 || settings.blockDurationMinutes < 1) {
    showStatus("Please use whole minutes of at least 1.", "error");
    return;
  }

  await extensionApi.runtime.sendMessage({ type: "save-settings", settings });
  showStatus("Saved locally on this device.", "success");
  await loadDashboard();
}

if (elements.customSiteForm) {
  elements.customSiteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const pattern = normalizePattern(elements.customSiteDomain.value);
    if (!pattern || !pattern.includes(".")) {
      showStatus("Enter a valid domain such as example.com.", "error");
      return;
    }

    const exists = dashboardData.settings.sites.some((site) => site.patterns.includes(pattern));
    if (exists) {
      showStatus("That domain is already being tracked.", "error");
      return;
    }

    dashboardData.settings.sites.push(createCustomSite(pattern));
    elements.customSiteDomain.value = "";
    showStatus("Custom site added. Save to apply it.", "success");
    renderSiteList();
  });
}

if (elements.saveButton) {
  elements.saveButton.addEventListener("click", () => {
    saveSettings().catch((error) => {
      showStatus(error.message || "Failed to save settings.", "error");
    });
  });
}

if (elements.openOptionsButton) {
  elements.openOptionsButton.addEventListener("click", () => {
    extensionApi.runtime.openOptionsPage();
  });
}

loadDashboard().catch((error) => {
  showStatus(error.message || "Failed to load ScrollBrake.", "error");
});
