# Nightswatch

*the order that mans the wall, speaks only when the threat is real*

Silence-first homelab status dashboard. Healthy = one quiet phrase. Something wrong = ranked issue list.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-5-646cff.svg)

![Nightswatch dashboard — healthy state](docs/screenshot.png)

---

| State | Display |
|---|---|
| **Healthy** | Centered italic phrase |
| **Warnings** | One-liner + ranked issue list |
| **Critical** | Same; critical issues sort first |

Monitors: WAN (1.1.1.1 / 8.8.8.8), TrueNAS SCALE (pools, temps, apps, SMART, updates), NIST NVD CVE feed, weather (optional). Issues auto-escalate with age. No backend required.

---

## Quick start

**Pre-built image (fastest):**

```sh
curl -o docker-compose.yml https://raw.githubusercontent.com/buildthehomelab/nightswatch/main/docker-compose.example.yml
# edit: set TRUENAS_HOST, TRUENAS_PORT, TRUENAS_KEY
docker compose up -d
```

Open `http://localhost:8080`.

**Demo mode (no TrueNAS):**

```sh
cp .env.example .env.local   # set DEMO=true
docker compose up            # or: npm run dev
```

**From source:**

```sh
git clone https://github.com/buildthehomelab/nightswatch.git && cd nightswatch
cp .env.example .env.local   # fill in values
docker compose up            # dev: HTTPS port 5173
```

---

## Configuration

Copy `.env.example` to `.env.local`. All options documented there.

| Variable | Required | Description |
|---|---|---|
| `TRUENAS_HOST` | TrueNAS | Hostname or IP |
| `TRUENAS_PORT` | TrueNAS | HTTPS port (default 443) |
| `TRUENAS_KEY` | TrueNAS | [API key](https://www.truenas.com/docs/scale/toptoolbar/managingapikeys/) from TrueNAS Settings > API Keys |
| `TRUENAS_UI_URL` | Optional | Browser-facing URL override (split DNS) |
| `DOZZLE_URL` | Optional | Dozzle instance URL for log viewing |
| `WEATHER_LOCATION` | Optional | City name or coordinates (wttr.in) |
| `CVE_KEYWORDS` | Optional | Comma-separated NVD terms (e.g. `plex,nginx`) |
| `DEMO` | No | `true` for mock data |

> `TRUENAS_KEY` and `TRUENAS_HOST` have no `VITE_` prefix; injected at proxy layer, never sent to browser.

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

Container serves HTTP on port 8080. Point a reverse proxy (Traefik, Caddy, Nginx Proxy Manager) at it for HTTPS and domain routing. Gate behind auth (Authelia, Authentik, Tailscale): this dashboard exposes NAS operational state and should not be public.

**Build from source:**

```sh
docker build --target runtime -t nightswatch .
docker run -e TRUENAS_HOST=nas.local -e TRUENAS_KEY=your-key -p 8080:80 nightswatch
```

**GHCR image tags:**

```
ghcr.io/buildthehomelab/nightswatch:latest
ghcr.io/buildthehomelab/nightswatch:0.1
```

---

## TrueNAS v26 warning

TrueNAS 26.0 removes REST (`/api/v2.0`) entirely. Do not upgrade before migration is complete. 
See [`docs/truenas-v26.md`](docs/truenas-v26.md).

---

[Contributing](CONTRIBUTING.md) | [MIT License](LICENSE)

---

Bundled wallpaper via [r/wallpaper](https://www.reddit.com/r/wallpaper).
