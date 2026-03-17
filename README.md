# ScrollBrake

<p align="center">
  <img src="icons/scrollbrake-128.png" alt="ScrollBrake extension icon" width="128" height="128">
</p>

ScrollBrake is a privacy-first browser extension that limits active time on social media sites. Each enabled site gets its own usage budget. When the budget runs out, ScrollBrake locks the site with a full-page countdown takeover for the configured break period.

It is built as a plain JavaScript Manifest V3 WebExtension with separate Chrome and Firefox outputs generated from the same source files.

## Features

- Built-in toggles for Facebook, Instagram, X, and YouTube
- Add custom domains from the extension UI
- Configurable usage limit and lockout duration
- Active usage tracking only while the page is visible and focused
- Compact toolbar popup plus a full settings page
- Browser-theme-aware light and dark mode
- Full-page lock screen with countdown timer and progress bar
- Any settings change resets tracked usage and active lock timers
- Cross-browser builds for Chrome and Firefox from one shared codebase
- Local-only persistence with extension local storage
- No analytics, accounts, syncing, or network requests

## Privacy

ScrollBrake stores settings and timer state only in local extension storage on the current device. It does not upload browsing history, create accounts, sync data to a server, or send analytics events.

## Project Structure

- `service-worker.js` handles storage, site usage tracking, and lock state
- `content-script.js` runs on matched pages and displays the lock overlay
- `popup.html` and `popup.js` power the toolbar popup
- `options.html` reuses the same settings logic in a full-page view
- Browser build outputs are generated into `dist/chrome` and `dist/firefox`
- Browser-specific manifest differences are handled by `scripts/build.mjs`

## Development Requirements

- Node.js installed locally
- npm available locally
- `zip` available locally for the packaging step
- Chrome for the Chrome build
- Firefox for the Firefox build

This project has no runtime or build dependencies, so there is no separate `npm install` step.

## Build

From the project root:

```bash
npm run build
```

Available scripts:

- `npm run build` builds both Chrome and Firefox targets
- `npm run build:chrome` builds only the Chrome target
- `npm run build:firefox` builds only the Firefox target
- `npm run package` packages the current build outputs into ZIP upload packages for both stores
- `npm run package:chrome` packages the current Chrome build output into a ZIP upload package
- `npm run package:firefox` packages the current Firefox build output into a ZIP upload package
- `npm run check` runs JavaScript syntax checks on the project files

Build outputs:

- Chrome: `dist/chrome`
- Firefox: `dist/firefox`
- Store upload ZIPs: `release/`

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Choose Load unpacked
4. Select `dist/chrome`
5. Reload the extension after code changes

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select `dist/firefox/manifest.json`
4. Reload the temporary add-on after rebuilding

## How It Works

1. Enable one or more built-in social sites or add custom domains.
2. Set a usage limit and a lockout duration.
3. ScrollBrake tracks time only while the tracked tab is visible and focused.
4. Once the usage limit is reached for a site, that site is locked for the configured break duration.
5. During lockout, the page is covered by a full-page countdown overlay.
6. Saving any settings resets tracked time so the new rules start cleanly.

## Current Defaults

- Usage limit: `15` minutes
- Lockout duration: `5` minutes
- Enabled built-ins: Facebook, Instagram, X, and YouTube
