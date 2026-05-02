# Nightswatch

*the order that mans the wall, speaks only when the threat is real*

React + Vite SPA. Minimal, attention-driven homelab status page. Silence is the default — UI shows only what needs operator attention.

## Stack

- React 18 + Vite 5, no router, no state library
- CSS custom properties for theming (no CSS-in-JS, no Tailwind)
- Fonts: Newsreader (serif headlines) + JetBrains Mono (mono labels/data)

## Key files

| File | Role |
|------|------|
| `src/App.jsx` | Root: state, keyboard handlers, issue assembly, all UI layout |
| `src/services/truenas.js` | TrueNAS API client + `nasIssues()` issue translation + utils — no JSX |
| `src/services/cve.js` | NVD CVE feed client + `useCve()` hook + `cveIssues()` issue translation — no JSX |
| `src/components/Dozzle.jsx` | Log viewer overlay — `DozzleIframe` (real, default) or `DozzleDemo` (mock, `DEMO=true`) |
| `src/components/CustomizePanel.jsx` | Dev control panel (state/theme/density toggles) |
| `src/data/fixtures.js` | Static fixture issues for healthy/warnings/critical demo states |
| `src/data/mockNas.js` | Mock TrueNAS API response for offline dev/testing |
| `src/index.css` | All styles, design tokens, theme vars |

## Architecture

Three top-level states driven by `issues.length` and severity:
- **healthy**: no issues → centered hero phrase
- **warnings**: issues exist, no crit → masthead + ranked list
- **critical**: any crit → same as warnings, crits sort first

`issues` array in App is assembled from:
1. Live TrueNAS issues via `nasIssues(nasData)` (when `enableTruenas`)
2. Live CVE issues via `cveIssues(cveData)` (when `enableCve`)
3. Error sentinel issues for unreachable NAS or NVD APIs
4. WAN issue prepended first (highest priority) when offline
5. Fixture issues injected in DEMO mode

## CVE integration

- Fetches from NVD API (`https://services.nvd.nist.gov/rest/json/cves/2.0`) — no proxy, direct browser fetch
- `useCve(enabled, keywords)` hook polls every **60 minutes**; cache TTL **1 hour** (localStorage `cve:cache`)
- Keywords: `VITE_CVE_KEYWORDS` (comma-separated) + auto-appends `"truenas"` when `enableTruenas` is on (`SERVICE_CVE_KEYWORDS` map)
- `VITE_CVE_DAYS_BACK` — how many days back to search (default 30)
- `VITE_CVE_MIN_CVSS` — minimum CVSS score to surface (default 4.0)
- Severity mapping: CVSS ≥ 9.0 → crit, ≥ 7.0 → warn, ≥ min → info; below min discarded
- Per-CVE first-seen timestamp in localStorage `cve:firstSeen`
- `cveIssues(data, keywords)` dedupes by CVE ID, sorts by CVSS score descending

## TrueNAS integration

- **Version: TrueNAS SCALE 25.10.3**
- Proxied through Vite dev server: `/truenas/*` → `$TRUENAS_HOST:$TRUENAS_PORT`
- Auth: `TRUENAS_KEY` env var (set in `.env.local`, no `VITE_` prefix — injected at proxy layer in vite.config.js, not exposed to browser)
- `TRUENAS_HOST` / `TRUENAS_PORT` — proxy target (server-side only, no `VITE_` prefix)
- `VITE_STOPPED_APP_HIDE_MINUTES=60` — hides stopped apps from NAS strip after N minutes
- `RELEASE_CACHE`: 10-min TTL Map for GitHub release version checks (linuxserver images mapped to upstream repos)
- `useTrueNas()` hook polls on mount; `nasIssues(data)` derives crit/warn issues from pool health, disk SMART, app update availability
- Uptime in App prefers `nasData.info.uptime_seconds`, falls back to session uptime

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate issues (j=prev, k=next — intentional, not vim-standard) |
| `Enter` | Expand/collapse focused issue |
| `1` / `2` / `3` | Filter critical / warning / advisory severity |
| `` ` `` / `h` / `?` | Toggle CustomizePanel (shortcuts table lives inside it) |
| `l` | Open Dozzle log viewer |
| `r` | Refresh (force re-render) |
| `Esc` | Close CustomizePanel |

## CustomizePanel

Dev-only controls, opened with backtick / `h` / `?`. Persisted to localStorage (`nightswatch:customize`) via `useCustomize()`.

Defaults (`CUSTOMIZE_DEFAULTS` in App.jsx):
- `theme`: "dark"
- `showWeather`: false
- `showWan`: true, `showUptime`: true, `showDate`: true
- `enableTruenas`: false — TrueNAS API polling disabled by default
- `enableCve`: false — NVD CVE feed disabled by default
- `showNas`: false — TrueNAS data strip hidden by default (independent of `enableTruenas`)
- `ambientPlacement`: "bottom"

## Design tokens

See `DESIGN.md` for the full design system reference (Notion-inspired). CSS custom properties on `:root`, switched via `data-theme="light|dark"` on `<html>`.

Light theme: `--paper #ffffff`, `--paper-2 #f6f5f4`, `--ink rgba(0,0,0,0.95)`, `--ink-2 #615d59`, `--ink-3 #a39e98`, `--warn #dd5b00`, `--crit #b03520`, `--ok #2a9d99`, `--accent #0075de`
Dark theme: `--paper #31302e`, `--paper-2 #3d3b38`, `--ink rgba(255,255,255,0.9)`, `--ink-2 #c5bfb5`, `--ink-3 #8a8478`, `--warn #e87a30`, `--crit #d05535`, `--ok #3bbfba`, `--accent #62aef0`

Font: `--sans` Inter (headlines, body, UI); `--mono` JetBrains Mono (log output only).
Borders: `1px solid var(--rule)` — whisper weight (`rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark).
Severity badges: pill (9999px radius) with tinted background. Action buttons: 4px radius. Detail cards: 12px radius with 4-layer card shadow.

## Phrases

`PHRASES` object in App.jsx, 9 named buckets. `pickPhrase(arr)` picks randomly, localStorage-backed per bucket (`nightswatch:phrase:{arr[0]}`), 1-min TTL — phrase stable across re-renders, rotates on next call after 60s, always different from previous pick.

Masthead phrase selection is priority-ordered (see LOGIC.md §1).

## Issue-to-container mapping

`ISSUE_TO_CONTAINER` in App.jsx maps issue IDs → Dozzle container names for "open in dozzle ›" button:
```
wan-down → pihole
```
(Only `wan-down` is currently wired. TrueNAS issue IDs like `nas-app-*` / `nas-pool-*` are unmapped.)

## WAN check

Probes both `https://1.1.1.1` and `https://8.8.8.8` in parallel (`mode: "no-cors"`) every 30s. Either success → WAN up. Both fail → increment `wanFailCount`. Requires 3 consecutive all-fail rounds before marking WAN down (`wanFailCount >= 3`). WAN issue injected first (highest priority).

## Production TODOs (from README)

- Wire issue actions to real backend endpoints (auth required)
- Add `aria-*` + keyboard support to issue rows (currently `<div>`)
- Real WAN check via router API (currently probes 1.1.1.1/8.8.8.8 directly from browser)
