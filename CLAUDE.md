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
| `src/components/Dozzle.jsx` | Log viewer overlay — `DozzleIframe` (real, default) or `DozzleDemo` (mock, `DEMO=true`) |
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

Fetches `https://1.1.1.1` with `mode: "no-cors"` every 30s. Requires 3 consecutive failures (`wanFailCount` ref) before marking WAN down, to avoid false positives. WAN issue is always injected first (highest priority) and removed from fixture set.

## Production TODOs (from README)

- Wire issue actions to real backend endpoints (auth required)
- Add `aria-*` + keyboard support to issue rows (currently `<div>`)
- Real WAN check via router API (currently probes 1.1.1.1/8.8.8.8 directly from browser)
