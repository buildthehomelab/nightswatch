# Nightswatch

*the order that mans the wall, speaks only when the threat is real*

A silence-first homelab status dashboard. When everything is healthy, you see a single quiet phrase. When something needs attention, it appears as a ranked list of incidents. No noise, no always-on widgets.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-5-646cff.svg)

---

## What it does

| State | What you see |
|---|---|
| **Healthy** | Centered italic phrase. Almost nothing. |
| **Warnings** | Sarcastic one-liner + ranked issue list |
| **Critical** | Same as warnings, but critical issues sort first |

It monitors:
- **WAN connectivity:** probes 1.1.1.1 and 8.8.8.8 every 30s, requires 3 consecutive failures before marking down
- **TrueNAS SCALE:** pool health, capacity, CPU/disk temps, memory, stopped apps, app updates, system updates, SMART alerts
- **CVE feed:** NIST NVD vulnerability database, filtered by keywords you configure
- **Weather:** via wttr.in (optional)

Issues auto-escalate with age. Keyboard-first navigation. Everything persists to localStorage with no backend required.

> **Demo:** set `DEMO=true` in `.env.local` to run with mock data. No TrueNAS needed.

---

## Quick start

### Docker (recommended)

```sh
git clone https://github.com/your-username/nightswatch.git
cd nightswatch
cp .env.example .env.local
# edit .env.local: set TRUENAS_HOST, TRUENAS_PORT, and TRUENAS_KEY at minimum
docker compose up
```

Open `https://localhost:5173` (self-signed cert; the TrueNAS proxy requires HTTPS).

### Without Docker

```sh
git clone https://github.com/your-username/nightswatch.git
cd nightswatch
npm install
npm run setup          # installs git hooks (run once)
cp .env.example .env.local
# edit .env.local: set TRUENAS_HOST, TRUENAS_PORT, and TRUENAS_KEY at minimum
npm run dev
```

### Demo mode (no TrueNAS required)

```sh
cp .env.example .env.local
# set DEMO=true in .env.local
docker compose up      # or: npm run dev
```

---

## Configuration

Copy `.env.example` to `.env.local` and fill in the values you need. All options are documented in `.env.example`.

Key variables:

| Variable | Required | Description |
|---|---|---|
| `TRUENAS_HOST` | For TrueNAS | Hostname or IP of your NAS |
| `TRUENAS_PORT` | For TrueNAS | HTTPS port (default 443) |
| `TRUENAS_KEY` | For TrueNAS | API key from TrueNAS Settings → API Keys |
| `TRUENAS_UI_URL` | Optional | Browser-facing URL override for TrueNAS links. Only needed for split DNS; derived from `TRUENAS_HOST`/`TRUENAS_PORT` if unset. |
| `DOZZLE_URL` | Optional | URL of your Dozzle instance for log viewing |
| `WEATHER_LOCATION` | Optional | City name or coordinates for wttr.in |
| `CVE_KEYWORDS` | Optional | Comma-separated NVD search terms (e.g. `plex,nginx`) |
| `DEMO` | No | `true` to run with mock data |

> **Security note:** `TRUENAS_KEY` and `TRUENAS_HOST` have no `VITE_` prefix; they are injected at the Vite proxy layer and never sent to the browser.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 |
| Build | Vite 5 |
| Styling | CSS custom properties — no Tailwind, no CSS-in-JS |
| State | `useState` / `useRef` / `useMemo` — no external library |
| Fonts | Barlow Condensed (display) + Rubik (UI) + JetBrains Mono (data) |
| Theme | Light / dark via `data-theme` on `<html>` |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (HTTPS, port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint (React + hooks rules) |
| `npm run test` | Vitest |
| `npm run setup` | Install git hooks (run once after cloning) |

**Docker:**

| Command | Description |
|---|---|
| `docker compose up` | Dev server with HMR (HTTPS, port 5173) |
| `docker compose -f docker-compose.prod.yml --env-file .env.local build` | Build production image |
| `docker compose -f docker-compose.prod.yml --env-file .env.local up -d` | Run production container (HTTP, port 8080) |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `j` / `k` | Navigate issues |
| `Enter` | Expand / collapse focused issue |
| `1` / `2` / `3` | Filter critical / warning / advisory |
| `l` | Open log viewer |
| `r` | Force refresh |
| `` ` `` / `h` | Open settings panel |
| `Esc` | Close overlay |

---

## Deployment

### Docker (recommended)

```sh
docker compose -f docker-compose.prod.yml --env-file .env.local build
docker compose -f docker-compose.prod.yml --env-file .env.local up -d
```

The container serves HTTP on port 8080 and handles the TrueNAS proxy internally — no external reverse proxy required for the proxy layer. Point your existing proxy (Traefik, Nginx Proxy Manager, Caddy) at port 8080 for HTTPS termination and domain routing.

Set `PORT=` in your environment to map a different host port.

### Manual

Build with `npm run build` and serve `dist/` behind a reverse proxy that forwards `/truenas/*` to your TrueNAS instance with the API key header injected:

```nginx
location /truenas/ {
    proxy_pass https://nas.local/;
    proxy_set_header Authorization "Bearer your-api-key";
    proxy_ssl_verify off;
}
```

Gate the entire dashboard behind your existing reverse-proxy auth (Authelia, Authentik, Tailscale) — it exposes operational controls.

---

## TrueNAS v26 note

TrueNAS 26.0 removes the REST API (`/api/v2.0`) entirely in favour of JSON-RPC over WebSocket. **Do not upgrade your NAS to v26 before the migration is complete.** See [`docs/truenas-v26.md`](docs/truenas-v26.md) for the full breakdown.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)
