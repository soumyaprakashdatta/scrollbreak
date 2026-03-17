# ScrollBrake

ScrollBrake is a privacy-first browser extension that limits active time on social media sites. Each enabled site gets its own usage budget. When the budget runs out, ScrollBrake locks the site with a full-page countdown takeover for the configured break period.

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

- Shared source lives in the project root
- Browser build outputs are generated into `dist/chrome` and `dist/firefox`
- Browser-specific manifest differences are handled by `scripts/build.mjs`

## Requirements

- Node.js installed locally
- Chrome for the Chrome build
- Firefox for the Firefox build

## Build

From [/Users/spd/workspace/github/lock_social_media](/Users/spd/workspace/github/lock_social_media):

```bash
npm run build
```

Available scripts:

- `npm run build` builds both Chrome and Firefox targets
- `npm run build:chrome` builds only the Chrome target
- `npm run build:firefox` builds only the Firefox target
- `npm run check` runs JavaScript syntax checks on the project files

Build outputs:

- Chrome: [/Users/spd/workspace/github/lock_social_media/dist/chrome](/Users/spd/workspace/github/lock_social_media/dist/chrome)
- Firefox: [/Users/spd/workspace/github/lock_social_media/dist/firefox](/Users/spd/workspace/github/lock_social_media/dist/firefox)

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Choose Load unpacked
4. Select [/Users/spd/workspace/github/lock_social_media/dist/chrome](/Users/spd/workspace/github/lock_social_media/dist/chrome)
5. Reload the extension after code changes

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select [/Users/spd/workspace/github/lock_social_media/dist/firefox/manifest.json](/Users/spd/workspace/github/lock_social_media/dist/firefox/manifest.json)
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
- Lockout duration: `1` minute
- Enabled built-ins: Facebook, Instagram, X, and YouTube
