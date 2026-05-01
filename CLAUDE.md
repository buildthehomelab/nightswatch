# Homelab Dashboard

React + Vite SPA. Minimal, attention-driven homelab status page. Silence is the default — UI shows only what needs operator attention.

## Stack

- React 18 + Vite 5, no router, no state library
- CSS custom properties for theming (no CSS-in-JS, no Tailwind)
- Fonts: Newsreader (serif headlines) + JetBrains Mono (mono labels/data)

## Key files

| File | Role |
|------|------|
| `src/App.jsx` | Root: state, keyboard handlers, issue assembly, layout |
| `src/components/TrueNas.jsx` | TrueNAS API client + `nasIssues()` + NAS strip UI |
| `src/components/Dozzle.jsx` | Mock log viewer overlay (mock only — production would iframe real Dozzle) |
| `src/components/CustomizePanel.jsx` | Dev control panel (state/theme/density toggles) |
| `src/data/fixtures.js` | Static fixture issues for healthy/warnings/critical demo states |
| `src/index.css` | All styles, design tokens, theme vars |

## Architecture

Three top-level states driven by `issues.length` and severity:
- **healthy**: no issues → centered hero phrase
- **warnings**: issues exist, no crit → masthead + ranked list
- **critical**: any crit → same as warnings, crits sort first

`issues` array in App is assembled from:
1. Fixture issues (from `CUSTOMIZE_DEFAULTS.state` via CustomizePanel)
2. Real WAN check (fetch `1.1.1.1`, requires 3 consecutive failures)
3. Live TrueNAS issues via `nasIssues(nasData)` — always injected alongside fixtures

## TrueNAS integration

- Proxied through Vite dev server: `/truenas/*` → `https://patronus.vaultrona.com:3443`
- Auth: `VITE_TRUENAS_KEY` env var (set in `.env.local`)
- `VITE_STOPPED_APP_HIDE_MINUTES=60` — hides stopped apps from NAS strip after N minutes
- `RELEASE_CACHE`: 10-min TTL Map for GitHub release version checks (linuxserver images mapped to upstream repos)
- `useTrueNas()` hook polls on mount; `nasIssues(data)` derives crit/warn issues from pool health, disk SMART, app update availability
- Uptime in App prefers `nasData.info.uptime_seconds`, falls back to session uptime

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate issues (j=prev, k=next — intentional, not vim-standard) |
| `Enter` | Expand/collapse focused issue |
| `h` or `?` | Help overlay |
| `l` | Open Dozzle log viewer |
| `r` | Refresh (force re-render) |
| `` ` `` | Toggle CustomizePanel |
| `Esc` | Close overlay |

## CustomizePanel

Dev-only controls, opened with backtick. Persisted to localStorage via `useCustomize()`.

Defaults (`CUSTOMIZE_DEFAULTS` in App.jsx):
- `state`: "warnings" (drives which fixtures show)
- `theme`: "ink"
- `density`: "regular"
- `showAmbient`: false — ambient header strip hidden by default
- `showWeather`: false
- `showNas`: false — TrueNAS data strip hidden by default

## Design tokens

CSS custom properties on `:root`, switched via `data-theme="light|dark"` on `<html>`.

Paper theme (light): `--paper #f4efe4`, `--ink #1a1814`, `--warn #a8741a`, `--crit #8a2a1f`, `--ok #4a6b3a`
Ink theme (dark): `--paper #14130f`, `--ink #ece7d8`, `--warn #d9a44a`, `--crit #d97a64`, `--ok #95b87f`

All borders are `0.5px solid var(--rule)` — never 1px+. No shadows except Dozzle panel.

## Issue-to-container mapping

`ISSUE_TO_CONTAINER` in App.jsx maps issue IDs → Dozzle container names for "open in dozzle ›" button:
```
wan-down → pihole, smart-tank → jellyfin, disk-media → sonarr, ups → watchtower
```

## WAN check

Fetches `https://1.1.1.1` with `mode: "no-cors"` every 30s. Requires 3 consecutive failures (`wanFailCount` ref) before marking WAN down, to avoid false positives. WAN issue is always injected first (highest priority) and removed from fixture set.

## Production TODOs (from README)

- Replace fixtures with live polling/SSE from status aggregator
- Replace mock Dozzle with iframe to real Dozzle instance
- Wire issue actions to real backend endpoints (auth required)
- Add `aria-*` + keyboard support to issue rows (currently `<div>`)
- Guard CustomizePanel behind `?dev=1` or remove entirely
- Real weather, real WAN check via router, real uptime from `/proc/uptime`
