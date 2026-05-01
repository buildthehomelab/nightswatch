# Nightswatch

*the order that mans the wall, speaks only when the threat is real*

## Overview

A minimal, attention-driven homelab status dashboard. The guiding principle is **silence is the default** — the UI shows only what needs the operator's attention. When everything is healthy, the page is mostly empty. When something is wrong, it appears as a ranked list of incidents, like a newspaper's corrections column. An embedded **Dozzle** log viewer is reachable on demand (per-issue link, footer link, or `L` keyboard shortcut) but never persistent UI.

The aesthetic is editorial and paper-like: serif headlines, monospace system data, warm off-white background. Deliberately not a "NOC dashboard" of gauges and traffic lights.

## About the Design Files

The files in `reference/` are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to ship as-is.

The task is to **recreate these designs in the target codebase's environment** (React, Vue, SvelteKit, SwiftUI, native, etc.) using its established patterns, component primitives, and styling system. If no environment exists yet, pick the most appropriate framework for the project — for a self-hosted homelab dashboard a small React + Vite SPA, a SvelteKit app, or an Astro site with islands all make sense.

The HTML reference uses inline-Babel JSX with global `window.*` exports because that's the prototype-friendly format. Production should use proper modules/imports.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, and interactions are intentional. Recreate pixel-perfectly using the codebase's libraries — but reach for the existing design system's primitives where they exist (Button, Sidebar, Dialog, etc.) rather than re-implementing chrome.

## Architecture

The dashboard has three top-level states driven by the live status of monitored systems:

| State      | Trigger                                       | UI                                                                              |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `healthy`  | No active issues                              | Single italic phrase + tiny ambient stats. Almost no UI.                        |
| `warnings` | One or more `warn`/`info` issues, no `crit`   | Masthead + ranked issue list                                                    |
| `critical` | One or more `crit` issues                     | Same layout as warnings — `crit` items always sort to the top                   |

There is **no separate "all OK grid"** view. That's deliberate.

## Screens / Views

### 1. Ambient header strip (always visible)

A single thin row at the top of the page, separated from content by a hairline rule.

- **Layout**: `display: flex; justify-content: space-between; align-items: baseline; gap: 24px; padding-bottom: 18px; border-bottom: 0.5px solid var(--rule);`
- **Typography**: JetBrains Mono, 11.5px, letter-spacing 0.02em, lowercase, color `--ink-3`
- **Left side**: current time (HH:mm 24h) · weekday, month, day
- **Right side**: outside weather · WAN status (with status dot) · uptime · last check
- **Status dot**: 6px circle, `--ok` green when WAN up, `--crit` red when WAN down

### 2. Masthead (alert states only)

- **Eyebrow**: time-of-day greeting ("Good morning." / "Good afternoon." etc), JetBrains Mono 11px, letter-spacing 0.18em, uppercase, color `--ink-3`
- **Headline**: "A few things <em>need a look.</em>", Newsreader serif, 64px, weight 400, line-height 1.05, letter-spacing -0.02em. The `<em>` portion is italic, weight 300, color `--ink-2`.
- **Padding**: 96px top / 24px bottom

### 3. Healthy state

Centered vertically in the available space.

- **Greeting eyebrow** (same as masthead)
- **Hero phrase**: italic Newsreader, 44px, weight 300, line-height 1.18, letter-spacing -0.015em, single line. Phrases rotate by day of month: "Nothing needs your attention." / "All quiet." / "Everything is as it should be." / "Nothing to report."
- **Ambient sub-line**: JetBrains Mono 11.5px lowercase, dot-separated stats: "14 services healthy · 42 days uptime · last incident 19 days ago"

### 4. Issue list

Each issue renders as a 3-column grid row separated by hairline rules.

- **Grid**: `grid-template-columns: 110px 1fr auto; gap: 24px; padding: 20px 0; border-bottom: 0.5px solid var(--rule);`
- **Hover**: row gets `background: var(--paper-2)` with negative-margin bleed (`margin: 0 -16px; padding: 20px 16px;`) for a subtle "lifting" effect
- **Cursor**: pointer; entire row is clickable to expand

**Column 1 — Severity tag** (110px):
- Mono 10.5px, letter-spacing 0.14em, uppercase
- Preceded by a 6px dot in the severity color
- Colors: `crit` → `--crit`, `warn` → `--warn`, `info` → `--ink-2`

**Column 2 — Body**:
- **Headline**: Newsreader 21px, line-height 1.3, letter-spacing -0.005em, color `--ink`. Trailing chevron `›` rotates 90° when open (transition 0.25s ease).
- **Meta row**: Mono 11px, color `--ink-3`. Source label uses `--ink-2`.

**Column 3 — When**:
- Mono 11px, color `--ink-3`, white-space nowrap, baseline-aligned

**Expanded details** (when row is open):
- Slides open via `max-height` transition (0 → 600px, 0.35s ease) + opacity fade
- Background `--paper-2`, 2px left-border in `--rule`, 16/18px padding, 2px border-radius
- Sections (separated by 0.5px `--rule` lines, 14px gap):
  1. **Description** — Newsreader 15.5px, line-height 1.55, max-width 60ch, color `--ink-2`
  2. **Logs** — Mono 11px, line-height 1.6. Timestamp is `--ink-3`, `err` lines `--crit`, `warn` lines `--warn`
  3. **Actions** — pill buttons: Mono 11px lowercase, transparent bg, 0.5px `--rule` border, 999px radius, 6/12px padding. The "open in dozzle ›" action sits at the right (`margin-left: auto`).

### 5. Dozzle overlay

Slides in from the right when triggered.

- **Scrim**: `position: fixed; inset: 0; background: rgba(20,18,14,0.42); backdrop-filter: blur(2px);` — fades in over 0.35s, click to dismiss
- **Panel**: `width: min(880px, 92vw); height: 100%; background: #0e0d0b; transform: translateX(100%) → 0` over 0.42s `cubic-bezier(.22, 1, .36, 1)`. Box-shadow `-32px 0 80px rgba(0,0,0,.45)` left edge.
- **Header**: 14/18px padding, 0.5px bottom border in `rgba(255,255,255,0.08)`. Title row: bold "dozzle" + container name + faint `http://dozzle.lan` URL. Close button on right with text "close · esc".
- **Body**: 2-column grid `220px 1fr`
  - **Sidebar**: container list grouped by purpose (`media`, `downloads`, `network`, `tools`). Group labels uppercase Mono 10px, letter-spacing 0.16em. Each container button: Mono 12px, 6/18px padding, leading 6px status dot (`ok`/`warn`/`crit`/`off`). Active container gets left-border 2px solid `#d9a44a` (warm amber), bg `rgba(255,255,255,0.04)`.
  - **Main**:
    - **Toolbar**: filter input (transparent dark bg, hairline border, focus tint amber) + three filter chips for info/warn/err (rounded-full, on-state border in amber tint)
    - **Stream**: log lines as 3-column grid (`90px 16px 1fr`, gap 10px). Timestamp `#5e594d`, level glyph (`·`/`!`/`✘`), message. `err` colored `#d97a64`, `warn` `#d9a44a`, `info` muted `#b3ad9c`. Lines hover gets `rgba(255,255,255,0.02)` background. Auto-scrolls to bottom; new lines append every ~1.4s simulating live tail.
    - **Footer**: pulsing dot + "tailing · N lines" left, container name + "live" right
- **Mobile** (≤720px): sidebar hidden, single-column main view
- **Dismiss**: scrim click, close button, or `Escape` key

## Interactions & Behavior

| Interaction                           | Behavior                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Click an issue row                    | Toggle expand. Only one issue open at a time (closing accordion).                |
| Click inside the expanded panel       | `e.stopPropagation()` so action buttons don't collapse the row.                  |
| Click action button                   | Stub for now. "open in dozzle ›" launches the overlay focused on related container. |
| Click footer "logs" link              | Opens Dozzle overlay focused on `sonarr` (default).                              |
| Press `L`                             | Opens Dozzle (when no input/textarea is focused).                                |
| Press `Escape` while Dozzle is open   | Closes Dozzle.                                                                   |
| Click Dozzle scrim                    | Closes Dozzle.                                                                   |
| Switch container in Dozzle sidebar    | Rebuilds initial backlog of ~32 lines for that container; new live lines append. |
| Type in Dozzle filter input          | Live substring filter on log message text (case-insensitive).                    |
| Toggle info/warn/err chips            | Show/hide log lines of that level.                                               |
| Tick                                  | Wall-clock updates every 30s (re-renders ambient strip and "last check").        |

### Animations

- Page-load entry: `@keyframes rise` — 6px translateY + opacity 0→1, 0.5s ease. Staggered with delays `.05s`, `.12s`, `.19s` on successive elements; issue rows get incremental `0.05 + i * 0.04s`.
- Issue expand: `max-height` 0→600px + opacity 0→1, 0.35s + 0.25s ease, plus `margin-top` 0→14px
- Chevron rotation: 0deg → 90deg, 0.25s ease
- Dozzle slide-in: `transform: translateX(100% → 0)`, 0.42s `cubic-bezier(.22, 1, .36, 1)`. Scrim fades over 0.35s ease.
- Live-tail pulse dot: opacity 0.4 ↔ 1, 1.6s ease-in-out infinite

### Issue → Container mapping

When an alert's "open in dozzle" is clicked, the overlay opens focused on the most relevant container:

```
certs-jellyfin → nginx
updates-docker → watchtower
wan-down       → pihole
smart-tank     → jellyfin
disk-media     → sonarr
ups            → watchtower
```

Production should derive this from each alert's actual `source` field.

## State Management

**Top-level app state** (currently React `useState`):
- `now: Date` — wall-clock, ticks every 30s
- `dozzleOpen: boolean`
- `dozzleContainer: string` — which container Dozzle is focused on

**Per-issue-list state**:
- `openId: string | null` — currently expanded row (start with the first issue open by default)

**Dozzle internal state**:
- `active: string` — selected container id
- `filter: string` — substring filter
- `showInfo / showWarn / showErr: boolean` — level filters
- `lines: LogLine[]` — log buffer, capped at 200 (oldest dropped)

**Tweaks state** (demo controls only — should be removed from production build, or guarded behind a dev flag):
- `state` — `healthy` / `warnings` / `critical` (drives which fixtures are shown)
- `theme` — `paper` / `ink` (light vs dark)
- `density` — `compact` / `regular`
- `showAmbient: boolean`
- `showWeather: boolean`

### Data fetching (production)

In a real deployment, replace the fixture imports with live polling/streaming from the operator's services:
- **Issues feed**: poll every 30–60s from a unified status endpoint, or subscribe via SSE/WebSocket. The backend would aggregate from Uptime Kuma, smartd, apcupsd, watchtower, certbot, etc.
- **Ambient data**: WAN status via ping, weather via OpenWeatherMap/local sensor, uptime from `/proc/uptime`
- **Dozzle logs**: in production, replace the mock log generator with an `<iframe src="http://dozzle.lan">` (Dozzle exposes itself via its own UI) or proxy its API. The mock terminal styling exists because the real Dozzle can't be iframed in this prototype environment.

## Design Tokens

### Colors — Paper theme (default)

```css
--paper:    #f4efe4;  /* page background — warm off-white */
--paper-2:  #ebe5d6;  /* hover, expanded panel bg */
--ink:      #1a1814;  /* primary text */
--ink-2:    #4a463d;  /* secondary text, italic emphasis */
--ink-3:    #8a8474;  /* tertiary text, mono labels */
--rule:      rgba(26, 24, 20, 0.14);  /* hairline borders */
--rule-soft: rgba(26, 24, 20, 0.08);
--warn:     #a8741a;  /* warning ochre */
--crit:     #8a2a1f;  /* critical oxblood */
--ok:       #4a6b3a;  /* healthy green — used sparingly */
```

### Colors — Ink theme (dark)

```css
--paper:    #14130f;
--paper-2:  #1c1a15;
--ink:      #ece7d8;
--ink-2:    #b3ad9c;
--ink-3:    #6e6957;
--rule:      rgba(236, 231, 216, 0.14);
--rule-soft: rgba(236, 231, 216, 0.07);
--warn:     #d9a44a;
--crit:     #d97a64;
--ok:       #95b87f;
```

### Colors — Dozzle overlay (always dark, regardless of theme)

```
panel bg:     #0e0d0b
stream bg:    #0a0907
text primary: #ece7d8
text body:    #d8d3c4 / #b3ad9c
text muted:   #8e8878
text dim:     #5e594d
border:       rgba(255,255,255,0.08)
hover:        rgba(255,255,255,0.02–0.06)
accent:       #d9a44a (warm amber — active container, focus rings)
err:          #d97a64
warn:         #d9a44a
```

### Typography

Two fonts only, both Google Fonts:

- **Newsreader** (serif) — wght 300/400/500/600, italic 400. Used for headlines, hero phrases, issue headlines, descriptions.
- **JetBrains Mono** — wght 400/500. Used for ambient strip, eyebrows, severity tags, timestamps, logs, action buttons, footer.

```
--serif: "Newsreader", "Iowan Old Style", "Apple Garamond", Georgia, serif;
--mono:  "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
```

Body default: `font-family: var(--serif); font-size: 18px; line-height: 1.5;` with `font-feature-settings: "ss01", "kern";` and `text-rendering: optimizeLegibility`.

### Type scale

| Use                          | Family    | Size    | Weight | Line-height | Letter-spacing | Style    |
| ---------------------------- | --------- | ------- | ------ | ----------- | -------------- | -------- |
| Page H1 (masthead)           | Newsreader| 64px    | 400    | 1.05        | -0.02em        | normal   |
| Hero phrase (healthy)        | Newsreader| 44px    | 300    | 1.18        | -0.015em       | italic   |
| Issue headline               | Newsreader| 21px    | 400    | 1.3         | -0.005em       | normal   |
| Description body             | Newsreader| 15.5px  | 400    | 1.55        | —              | normal   |
| Ambient strip / footer       | Mono      | 11.5px  | 400    | 1.4         | 0.02em         | lowercase|
| Eyebrow                      | Mono      | 11px    | 400    | —           | 0.18em         | uppercase|
| Section label                | Mono      | 10.5px  | 400    | —           | 0.16em         | uppercase|
| Severity tag                 | Mono      | 10.5px  | 400    | —           | 0.14em         | uppercase|
| Issue meta / when            | Mono      | 11px    | 400    | —           | 0.02em         | —        |
| Log line                     | Mono      | 11–12px | 400    | 1.55–1.6    | —              | —        |
| Action button                | Mono      | 11px    | 400    | —           | 0.04em         | lowercase|

### Spacing

The design uses a loose 4/8/12/14/16/18/20/24/28/32/48/56/64/96 px scale. Page max-width: **880px**. Page horizontal padding: **48px** desktop / **24px** mobile (≤640px). Page top padding: **56px**. Bottom padding: **96px**.

### Border radii

- Action pill button: `999px`
- Dozzle filter input / chips: `4px`
- Dozzle panel: `0` (full-bleed right edge)
- Expanded issue panel: `2px` (very subtle)

### Shadows

- Dozzle panel: `-32px 0 80px rgba(0, 0, 0, 0.45)`
- (No card shadows elsewhere — the design relies on rules and tone, not elevation.)

### Hairlines

All borders are `0.5px solid var(--rule)`. This intentional hairline weight is core to the editorial feel — never use 1px+ borders.

## Assets

No bitmap assets, icons, or images. All visual elements are CSS or text glyphs (`›`, `·`, `✘`, `!`). Status is communicated through type, color, and 6px circles drawn in CSS. The brand-quiet aesthetic is the design — don't add icon libraries.

## Accessibility notes

- Issue rows are clickable but currently use `<div>`. In production, wrap in a `<button>` or add `role="button"`, `tabindex="0"`, and keyboard handlers (Enter/Space toggles).
- Dozzle's `Escape` handler is active only when the overlay is open. The scrim should `aria-hidden="true"` the underlying page when open, and focus should trap inside the dialog (use a real `<dialog>` element or focus-trap library).
- Color contrast: paper-theme `--ink` on `--paper` is ~12:1; `--ink-3` on `--paper` is ~3.7:1 — fine for non-essential meta but check WCAG AA for any critical labels you add.
- Respect `prefers-reduced-motion`: all `rise`, slide-in, and pulse animations should be disabled or shortened.

## Files

```
reference/
  Homelab Dashboard.html   # entry point, all CSS, font imports, mounts React
  app.jsx                  # main App, ambient strip, masthead, healthy state, issue list
  data.jsx                 # ISSUE_FIXTURES — sample issues for healthy/warnings/critical states
  dozzle.jsx               # Dozzle overlay component, mock log streams
  tweaks-panel.jsx         # demo control panel — REMOVE OR DEV-FLAG in production
```

The reference HTML uses inline-Babel JSX (`<script type="text/babel">`) and global `window.*` exports because that's the prototype-friendly format. In production, use proper ES modules and a build step.

## Production checklist

- [ ] Replace `ISSUE_FIXTURES` with live polling/SSE from your status aggregator
- [ ] Replace mock Dozzle terminal with an iframe to your real Dozzle instance, or proxy its API
- [ ] Wire issue actions ("renew now", "restart pppoe", etc.) to real backend endpoints — these should require auth
- [ ] Add `aria-*` attributes and keyboard support to issue rows
- [ ] Add `prefers-reduced-motion` media query to disable rise/slide-in/pulse animations
- [ ] Remove the Tweaks panel from production builds (or guard behind `?dev=1`)
- [ ] Implement real weather source (OpenWeatherMap, local PWS, etc.)
- [ ] Implement real WAN check (ping 1.1.1.1 every 30s, or read from your router)
- [ ] Implement uptime read from `/proc/uptime` or your monitoring system
- [ ] Decide auth model — this dashboard exposes operational controls; gate behind your existing reverse-proxy auth (Authelia, Authentik, Tailscale) or add SSO
- [ ] Decide on alert silencing/acknowledgement persistence (localStorage? backend?)
- [ ] Add an `/all-services` route for the footer link (full inventory grid for occasional review)
