# Nightswatch — Features

*The order that mans the wall, speaks only when the threat is real.*

Nightswatch is a silence-first homelab monitoring dashboard. It shows nothing when everything is fine — and surfaces exactly what needs attention when something is wrong.

---

## The Core Philosophy

Most dashboards are always-on noise. Nightswatch inverts that: the healthy state is a single quiet phrase. No widgets. No graphs. No panels to read. If you're not needed, you won't be bothered.

When something breaks, it tells you clearly, ranks by severity, and gives you the context to act — not a wall of metrics to interpret.

---

## Three-State Dashboard

The entire UI shifts based on what's wrong:

| State | What you see |
|-------|-------------|
| **Healthy** | Centered hero phrase (time-of-day bucket, rotates hourly) |
| **Warnings** | Sarcastic masthead phrase + ranked issue list |
| **Critical** | Same as warnings — critical issues sort first |

Transitions are instant. No reload. No polling indicator. It either needs you or it doesn't.

---

## Issue Intelligence

### Severity Levels
Issues are classified as **critical**, **warning**, or **advisory (info)**.

### Time-Based Escalation
Issues automatically escalate as they age:
- Pool capacity: warn → crit after 4 hours at high usage
- Stopped apps: warn → crit after 7 days stopped, or immediately if crashed
- App updates: info → warn after 7 days unpatched
- CPU temperature: warn → crit above 85°C

### Issue Cards
Each issue shows:
- Severity badge + headline + source
- Age / timestamp
- Expandable detail: structured log lines, full description, action buttons
- "Ignore" button — per-incident, timestamped, persisted across sessions

### Ignored Issue Tracking
- Ignore any issue for the duration of that incident (keyed to the event timestamp)
- Ignored issues remain in localStorage; stale keys are silently pruned from display
- Masthead escalates if you've had an ignored issue for more than 2 days

---

## WAN Connectivity Monitoring

Probes both `1.1.1.1` (Cloudflare) and `8.8.8.8` (Google) every 30 seconds.

- Either succeeds → WAN up, no issue
- Both fail → fail counter increments
- **3 consecutive all-fail rounds required** before marking WAN down — eliminates false positives from transient blips
- WAN down issue is always priority-injected first — it trumps everything else

---

## TrueNAS SCALE Integration

Full integration with TrueNAS SCALE via its REST API (`v2.0`), proxied through the Vite dev server so your API key is never exposed to the browser.

### What it monitors

| Category | What triggers an issue |
|----------|------------------------|
| **Pool health** | Any pool not in ONLINE status → critical |
| **Pool capacity** | ≥ 80% used → warning, ≥ 90% or age ≥ 4h → critical |
| **CPU temperature** | ≥ 70°C → warning, ≥ 85°C → critical |
| **Memory usage** | ≥ 80% service memory → warning, ≥ 90% → critical |
| **Stopped apps** | Non-RUNNING app → warning; crashed or 7d+ stopped → critical |
| **App updates** | Update available → info; ≥ 7 days old → warning |
| **System updates** | New TrueNAS version available → info (beta profile → warning) |

### App version checking
Checks GitHub for latest image releases. linuxserver images are mapped to their upstream repos for accurate version comparison. Results cached 4 hours in localStorage.

### Ambient NAS strip
A configurable footer/header strip shows live NAS stats at a glance:
- Hostname (linked to TrueNAS UI)
- Load average
- CPU temperature (colored at warn/crit thresholds)
- Free memory
- Network throughput (↓rx ↑tx)
- Running apps / total apps
- Per-pool usage with colored status dots

---

## Docker Integration

Monitors a Docker daemon — via Unix socket (same-host) or a socat TCP bridge — and surfaces container health problems as issues.

### Connection methods

| Method | Config | Use case |
|--------|--------|----------|
| Unix socket | `DOCKER_SOCKET=/var/run/docker.sock` | Nightswatch runs on the Docker host |
| TCP bridge | `DOCKER_HOST=docker.local` + `DOCKER_PORT=2375` | Remote host; socat forwards the socket over TCP |

`DOCKER_SOCKET` takes precedence when both are set. The connection is proxied server-side (same pattern as TrueNAS); the raw socket is never exposed to the browser.

### What it monitors

| Condition | Severity | Notes |
|-----------|----------|-------|
| Health check failing (`unhealthy`) | critical | Immediate; tracks first-seen for age display |
| Exited with non-zero code | critical | OOM kill (137) and segfault (139) get specific labels |
| Container in active restart loop | critical | `State: restarting` |
| Exited cleanly (code 0), restart policy set | warning | Escalates to critical after 4 hours |
| Running with restart count ≥ threshold | warning | Escalates to critical after 4 hours; threshold via `DOCKER_RESTART_WARN` (default 5) |

Containers that exit cleanly with restart policy `no` (one-shot jobs) generate no issue.

### Ambient strip chip

When Docker is enabled and the ambient strip is on, a `docker N/M` chip shows running vs total containers with a colored status dot (green = all clear, yellow = warning, red = critical).

Hovering the chip opens a popover showing:

- Summary counts (running, stopped, paused) and engine version
- Non-running containers with their state and severity color
- **Running containers** sorted by CPU usage (highest first) — each showing the container name and the actual running image version extracted from OCI or LinuxServer `build_version` labels, not just the compose tag
- List is scrollable; up to 10 visible at once

### Issue shape

Each Docker issue includes:

- Container name, image, status string
- First-seen timestamp with age display
- `ignoreKey` scoped to the container + incident timestamp (re-fires if the container crashes again)
- Optional "open portainer" action link (requires `DOCKER_UI_URL`)

### localStorage keys

| Key | Contents |
|-----|---------|
| `docker:firstSeen` | `{[issueId]: timestamp}` — per-issue first-seen for unhealthy / bad-exit / crashloop |
| `docker:stoppedSince` | `{[containerName]: isoDate}` — when each container last transitioned to non-running |

---

## CVE Security Advisory Feed

Pulls live vulnerability data from the **NIST National Vulnerability Database (NVD)** and surfaces CVEs relevant to your stack as dashboard issues.

### How it works
- Fetches NVD CVE API every 60 minutes; results cached 1 hour per keyword
- You configure keywords via `VITE_CVE_KEYWORDS` (e.g. `truenas,plex,nginx,unifi`)
- When TrueNAS integration is enabled, `truenas` is automatically added as a keyword
- Per-CVE first-seen timestamp tracked in localStorage for age-based context

### Severity mapping
| CVSS score | Issue severity |
|-----------|---------------|
| ≥ 9.0 | critical |
| ≥ 7.0 | warning |
| ≥ min (default 4.0) | advisory |
| < min | discarded |

### Configurable thresholds
- `VITE_CVE_MIN_CVSS` — minimum CVSS score to surface (default 4.0)
- `VITE_CVE_DAYS_BACK` — how far back to search (default 30 days)

Each CVE issue links directly to its NVD detail page.

---

## Sandbox Panels

Two configurable iframe panels slide in from the right: left panel (`h`) and right panel (`l`). Point them at any internal tool: logs, dashboards, admin UIs.

- URLs set via `SANDBOX_LEFT_URL` / `SANDBOX_RIGHT_URL` env vars or in the Customize panel (persisted to localStorage)
- Only one panel can be open at a time; opening one closes the other
- Issue actions can open the right panel (e.g. WAN down)
- Press the same key or `Esc` to dismiss; empty URL: key has no effect

---

## Keyboard-First Navigation

Every action has a keyboard shortcut. Mouse optional.

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate issues up / down |
| `Enter` | Expand / collapse focused issue |
| `1` / `2` / `3` | Filter critical / warning / advisory |
| `h` | Open / close left panel |
| `l` | Open / close right panel |
| `r` | Force refresh |
| `` ` `` | Open settings panel |
| `Esc` | Close overlay |

Severity filter chips are also clickable for mouse users.

---

## Ambient Strip

A persistent strip (top or bottom) shows ambient homelab state without cluttering the main view:

- Current time + date
- WAN status dot (up/down)
- System uptime (from TrueNAS if connected, otherwise session uptime)
- Outside weather (via wttr.in, configurable location)
- Full TrueNAS stats (toggleable per-metric)

All ambient items are individually toggleable. Strip placement (top/bottom) is configurable.

---

## Contextual Masthead Phrases

When issues exist, a sarcastic one-liner appears above the list. Phrase selection is priority-driven:

1. WAN down → *"404: Internet not found."*
2. Ignored issue > 2 days old → *"Outstanding. Truly outstanding."*
3. Crit stale for 4+ hours → *"SNAFU."*
4. Multiple crits → *"everything is on fire. As it should be."*
5. Crit + ignored items → *"Oh honey."*
6. Single crit → *"This is fine."*
7. Multiple warns → *"Yikes."*
8. Single warn → *"Minor turbulence."*

Phrases rotate every 60 seconds, never repeat back-to-back. Each bucket is independently tracked in localStorage.

---

## Settings Panel

Press `` ` `` to open the customization panel. All settings persist across sessions via localStorage.

- Light / dark theme
- Background image (with fit, position, and dim controls)
- Ambient strip placement and per-metric visibility (date, uptime, rank, WAN, weather)
- TrueNAS enable + ambient strip sub-toggles (apps, CPU temp, load, memory, name, network, pools)
- CVE feed enable
- Ignored issues list (with per-issue unignore)
- Keyboard shortcuts reference

---

## Zero-Backend Design

- Pure React + Vite SPA — no server, no database, no auth system
- TrueNAS API key injected at the Vite proxy layer — **never exposed to the browser**
- NVD CVE feed fetched directly from the browser (public API, no key required)
- All state in localStorage — settings, ignored issues, phrase history, release cache
- Works as a local dev server or deployed as static files behind a reverse proxy

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 |
| Build | Vite 5 |
| Styling | CSS custom properties — no Tailwind, no CSS-in-JS |
| State | `useState` / `useRef` / `useMemo` — no external state library |
| Routing | None |
| Fonts | Barlow Condensed (display) + Rubik (UI) + JetBrains Mono (mono labels/data) |
| Theme | Light / dark via `data-theme` on `<html>` |
