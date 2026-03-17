# Social Lock

Social Lock is a Manifest V3 Chrome extension that limits active time on social media sites. Each enabled site gets its own usage budget. When the budget is used up, the extension locks that site with a full-page countdown for the configured break period.

## Features

- Built-in toggles for Facebook, Instagram, X, and YouTube
- Add custom domains from the extension UI
- Configurable usage limit and lockout duration
- Active usage tracking only while the page is visible and focused
- Local-only persistence with `chrome.storage.local`
- No analytics, accounts, syncing, or network requests

## Privacy

The extension stores settings and timer state only in Chrome's local extension storage on the current device. This is the recommended storage mechanism for small, structured extension settings and avoids sharing user data outside the browser.

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Choose Load unpacked
4. Select this folder: `/Users/spd/workspace/github/lock_social_media`
