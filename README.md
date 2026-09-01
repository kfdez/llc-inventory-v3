# LLC Inventory v3

VPS backend helper for Discord sales tracking and Google Sheets inventory sync.

This repo intentionally does not contain the Cloudflare scanner PWA. The PWA
lives in `kfdez/llc-scanner`.

## Scope

- Discord bot commands and message handling for sales/capture workflows
- Local SQLite queue/state for background capture jobs
- Apps Script client for reading/writing the shared Google Sheets database
- Optional Collectr proxy/relay helpers for server-side Collectr access
- Optional local image analysis helpers for QR/sticker capture

## Out of Scope

- Cloudflare Worker deployment
- Mobile/browser PWA UI
- Purchase import UI
- Apps Script source ownership

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run db:init
npm test
npm start
```

## VPS Service

The production service should run:

```text
WorkingDirectory=/opt/llc-inventory-v3
ExecStart=/usr/bin/node src/index.cjs
```

The service expects its runtime values in `.env`.

## Shared Database

The VPS helper talks to the shared Google Sheets database through the deployed
Apps Script web app configured by `APPS_SCRIPT_API_BASE_URL`.
