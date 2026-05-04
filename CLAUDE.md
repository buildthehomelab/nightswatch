# Nightswatch

*the order that mans the wall, speaks only when the threat is real*

React + Vite SPA. Minimal, attention-driven homelab status page. Silence is the default: UI shows only what needs operator attention.

## Stack

- React 18 + Vite 5, no router, no state library
- CSS custom properties for theming (no CSS-in-JS, no Tailwind)
- Fonts: Barlow Condensed (display) + Rubik (UI) + JetBrains Mono (mono labels/data)

## Key files

| File | Role |
|------|------|
| `src/App.jsx` | Root: state, keyboard handlers, issue assembly, all UI layout |
| `src/services/truenas.js` | TrueNAS API client + `nasIssues()` issue translation + utils, no JSX |
| `src/services/cve.js` | NVD CVE feed client + `useCve()` hook + `cveIssues()` issue translation, no JSX |
| `src/components/AmbientPopover.jsx` | Popover detail panels for ambient strip chips |
| `src/components/Dozzle.jsx` | Log viewer overlay: `DozzleIframe` (real) or `DozzleDemo` (mock, `DEMO=true`) |
| `src/components/CustomizePanel.jsx` | Settings panel (theme/density/feature toggles) |
| `src/data/fixtures.js` | Static fixture issues for demo states |
| `src/data/mockNas.js` | Mock TrueNAS API response for offline dev |
| `src/index.css` | All styles, design tokens, theme vars |

## Docs

- [`docs/features.md`](docs/features.md) — full feature reference
- [`docs/logic.md`](docs/logic.md) — state machine, issue pipeline, data flow
- [`docs/design.md`](docs/design.md) — design tokens, typography, spacing
- [`docs/truenas-v26.md`](docs/truenas-v26.md) — ⚠️ breaking changes in TrueNAS 26
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to add integrations and phrases

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

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate issues (j=prev, k=next) |
| `Enter` | Expand/collapse focused issue |
| `1` / `2` / `3` | Filter critical / warning / advisory severity |
| `` ` `` / `h` | Toggle CustomizePanel |
| `l` | Open Dozzle log viewer |
| `r` | Refresh |
| `Esc` | Close overlay |

## Design tokens

See `docs/design.md` for the full reference. CSS custom properties on `:root`, switched via `data-theme="light|dark"` on `<html>`.

## TrueNAS version

Currently targets **TrueNAS SCALE 25.10.x** (REST API v2.0). TrueNAS 26 removes REST — see `docs/truenas-v26.md` before upgrading.
