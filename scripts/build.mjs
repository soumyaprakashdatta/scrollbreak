import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");

const sharedFiles = [
  "README.md",
  "content-script.js",
  "options.html",
  "popup.css",
  "popup.html",
  "popup.js",
  "service-worker.js"
];

const baseManifest = {
  manifest_version: 3,
  name: "ScrollBrake",
  description: "Block social media sites after a configurable amount of active usage time with a timed lockout.",
  version: "1.0.0",
  icons: {
    16: "icons/scrollbrake-16.png",
    32: "icons/scrollbrake-32.png",
    48: "icons/scrollbrake-48.png",
    128: "icons/scrollbrake-128.png"
  },
  permissions: ["storage", "tabs"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "service-worker.js",
    type: "module"
  },
  action: {
    default_title: "ScrollBrake",
    default_popup: "popup.html",
    default_icon: {
      16: "icons/scrollbrake-16.png",
      32: "icons/scrollbrake-32.png"
    }
  },
  options_page: "options.html",
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["content-script.js"],
      run_at: "document_start"
    }
  ]
};

const browserOverrides = {
  chrome: {},
  firefox: {
    browser_specific_settings: {
      gecko: {
        id: "scrollbrake@local.dev"
      }
    }
  }
};

function buildManifest(target) {
  return {
    ...baseManifest,
    ...browserOverrides[target]
  };
}

function copySharedAssets(targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const relativePath of sharedFiles) {
    cpSync(join(rootDir, relativePath), join(targetDir, relativePath));
  }

  cpSync(join(rootDir, "icons"), join(targetDir, "icons"), { recursive: true });
}

function buildTarget(target) {
  const targetDir = join(distDir, target);
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  copySharedAssets(targetDir);
  writeFileSync(
    join(targetDir, "manifest.json"),
    `${JSON.stringify(buildManifest(target), null, 2)}\n`,
    "utf8"
  );
}

function main() {
  const requestedTarget = process.argv[2] || "all";
  const targets = requestedTarget === "all" ? ["chrome", "firefox"] : [requestedTarget];

  for (const target of targets) {
    if (!(target in browserOverrides)) {
      throw new Error(`Unsupported build target: ${target}`);
    }
    buildTarget(target);
  }
}

main();
