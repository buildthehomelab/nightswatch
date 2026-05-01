# Dashboard Logic Reference

Homelab status dashboard. Single-page React SPA. **Silence is the default** — UI shows only what needs operator attention.

---

## 1. Three-State Machine

State is driven by `visibleIssues.length` and severity in `App.jsx`.

```
visibleIssues.length === 0
  → healthy: centered hero phrase + running services count

visibleIssues has items, none are crit
  → warnings: masthead + ranked issue list

visibleIssues has any crit
  → critical: same as warnings, crits sort first
```

### Masthead Phrase Rules

Phrases are random strings drawn from `PHRASES` buckets via `pickPhrase()`. Priority (first match wins):

| Priority | Condition | Phrase bucket |
|----------|-----------|---------------|
| 1 | `wan-down` in issues | `PHRASES.wanDown` |
| 2 | any ignored key timestamp > 2 days old | `PHRASES.ignoredDays` |
| 3 | oldest crit age ≥ 4h (`MASTHEAD_STALE_MS`) | `PHRASES.stale` |
| 4 | crits > 1 | `PHRASES.multiCrit` |
| 5 | crits > 0 AND `ignored.size > 0` | `PHRASES.critIgnored` |
| 6 | crits > 0 | `PHRASES.crit` |
| 7 | issues > 1 | `PHRASES.multiIssue` |
| 8 | fallback (single warn) | `PHRASES.singleWarn` |

### pickPhrase

```
pickPhrase(arr):
  key = `nightswatch:phrase:${arr[0]}`
  if stored idx exists AND age < 1 minute → return arr[stored.idx]
  pick random idx ≠ last idx
  save {idx, ts} to localStorage
  return arr[idx]
```

Guarantees phrase stability across re-renders for 60s, always rotates on refresh after 1 min.

---

## 2. Issues Assembly Pipeline

Runs in `App.jsx` on every render cycle:

```
1. liveIssues = nasIssues(nasData)       // TrueNAS-derived
2. if (!wanUp) prepend WAN crit issue    // always highest priority
3. merge fixture issues from dev panel   // for demo/testing
4. visibleIssues = filter out ignored    // via ignoreKey map
```

### WAN Issue Shape

```js
{
  id: "wan-down",
  severity: "crit",
  label: "wan down",
  headline: "Internet connection is offline.",
  source: "connectivity check · 1.1.1.1 · 8.8.8.8",
  when: "since HH:MM" | "{age} ago",
  firstSeenTs: wanDownSince,             // drives masthead stale check
  ignoreKey: "wan-down:{timestamp}",
  actions: ["restart pppoe", "ping ISP gateway", "ssh edgerouter"]
}
```

### Ignored Issues Persistence

- localStorage key: `dashboard:ignored`
- Format: `Map<ignoreKey, label>` serialized as `[...map]` (array of `[k, v]` tuples)
- Filter condition: `!i.ignoreKey || !ignored.has(i.ignoreKey)`

---

## 3. WAN Check

Runs every **30 seconds** in `App.jsx`.

```
probe both: https://1.1.1.1  +  https://8.8.8.8
  (mode: "no-cors", cache: "no-store")

either succeeds:
  wanFailCount = 0
  wanUp = true
  wanDownSince = null

both fail:
  wanFailCount++
  wanFailCount === 2 → capture wanDownSince = new Date()
  wanFailCount >= 3  → wanUp = false  (3 consecutive failures required)
```

Requires 3 consecutive failures to avoid false positives from transient network blips.

---

## 4. TrueNAS Issue Derivation

**Poll interval**: every 60 seconds via `useTrueNas()` hook.  
**API**: `/truenas/api/v2.0/*` (proxied — see §8).

`nasIssues(nasData)` in `TrueNas.jsx` derives issues:

### Issue Rules

| Issue | Trigger | `warn` | `crit` | Notes |
|-------|---------|--------|--------|-------|
| CPU temp | temp ≥ 70°C | < 85°C | ≥ 85°C | shows age after 1 min |
| Memory | services mem ≥ 80% | < 90% | ≥ 90% | `physmem - memFree - arcSize` |
| System update | new version available | beta profile | — | `info` if stable |
| Pool status | status ≠ ONLINE | — | always crit | clears when ONLINE |
| Pool capacity | used ≥ 80% | < 90% AND < 4h old | ≥ 90% OR age ≥ 4h | escalates warn→crit |
| Stopped app | app not RUNNING | < 7d, not crashed | crashed OR age ≥ 7d | hidden after `STOPPED_HIDE_MINUTES` |
| App update | update available | < 7d old | — | escalates info→warn at 7d |

### Severity Escalation Summary

```
Pool capacity:   warn → crit if (used ≥ 90%) OR (age ≥ 4h)
App update:      info → warn if (age ≥ 7d)
Stopped app:     warn → crit if (state = CRASHED) OR (age ≥ 7d)
CPU temp:        warn → crit if (temp ≥ 85°C)
```

### Stopped App Tracking

- `stoppedSince` Map stored in localStorage (`truenas:stoppedSince`)
- Timestamp set when app transitions RUNNING → non-RUNNING
- Cleared when app returns to RUNNING
- App hidden from NAS strip if stopped > `VITE_STOPPED_APP_HIDE_MINUTES` (default 60)

### Release Cache

- Checks GitHub for latest app image versions
- TTL: **4 hours** — stored in localStorage `truenas:releaseCache`
- Fetches `releases/latest`, falls back to first tag if no latest
- linuxserver images mapped to upstream repos for version comparison

---

## 5. Keyboard Shortcuts

All handlers skip when an INPUT or TEXTAREA is focused.

| Key | Scope | Action |
|-----|-------|--------|
| `j` | IssueList | Navigate prev issue (up the list) |
| `k` | IssueList | Navigate next issue (down the list) |
| `Enter` | IssueList | Expand / collapse focused issue |
| `1` | IssueList | Toggle critical severity filter |
| `2` | IssueList | Toggle warning severity filter |
| `3` | IssueList | Toggle info severity filter |
| `l` | App | Toggle Dozzle log viewer |
| `r` | App | Refresh (force re-render + new timestamp) |
| `` ` `` / `h` / `?` | CustomizePanel | Toggle CustomizePanel (keyboard shortcuts table lives inside it) |
| `Esc` | CustomizePanel | Close CustomizePanel |

> **Note:** `j` = prev, `k` = next. Intentional inversion from vim convention.

---

## 6. CustomizePanel Settings

localStorage key: `nightswatch:customize`  
Opens automatically if URL contains `?dev`. Toggle with backtick / `h` / `?`.

| Key | Default | Effect |
|-----|---------|--------|
| `theme` | `"dark"` | `data-theme` on `<html>` → light or dark CSS vars |
| `showWeather` | `false` | weather string in ambient strip |
| `showWan` | `true` | WAN up/down in ambient strip |
| `showUptime` | `true` | system uptime in ambient strip |
| `showDate` | `true` | current date in ambient strip |
| `enableTruenas` | `false` | enables TrueNAS API polling (useTrueNas hook); controls issue derivation |
| `showNas` | `false` | TrueNAS data strip (hidden by default; independent of enableTruenas) |
| `showNasName` | `true` | NAS hostname as link |
| `showNasLoad` | `true` | load average |
| `showNasCpuTemp` | `true` | CPU temp, colored at warn/crit thresholds |
| `showNasMemory` | `true` | free memory in bytes |
| `showNasApps` | `true` | running / total app count |
| `showNasPools` | `true` | pool % used, colored dots at warn/crit |
| `ambientPlacement` | `"bottom"` | ambient strip position: `bottom` or `top` |

**Ignored panel** shows only currently active ignored issues — ones whose `ignoreKey` exists in the current `issues` array. Historical/stale ignored keys are silently filtered out of the display (but remain in localStorage until manually cleared).

---

## 7. Issue → Dozzle Container Map

"Open in dozzle ›" button appears when `ISSUE_TO_CONTAINER[issue.id]` exists.

| Issue ID | Dozzle Container |
|----------|-----------------|
| `wan-down` | `pihole` |

Only `wan-down` is wired — it's the only live issue ID that matches. All `nasIssues()` IDs (`nas-app-*`, `nas-pool-*`, etc.) are unmapped; the button won't appear for TrueNAS issues until entries are added.

---

## 8. Network & Proxy

Configured in `vite.config.js`. Applies to both dev and preview servers.

| Route | Target | Notes |
|-------|--------|-------|
| `/truenas/*` | `$TRUENAS_HOST:$TRUENAS_PORT` | Injects `Authorization: Bearer $TRUENAS_KEY`; strips hop-by-hop headers; `rejectUnauthorized: false` |
| `/wttr/*` | `https://wttr.in` | Rewrites path; User-Agent spoofed to `curl/7.88.1` |
| GitHub API | `https://api.github.com` | Direct (public, no proxy) |

### Env Vars

| Var | Where | Effect |
|-----|-------|--------|
| `TRUENAS_KEY` | `.env.local` (no `VITE_` prefix) | Injected as Bearer token at proxy layer; never exposed to browser |
| `TRUENAS_HOST` | `.env.local` (no `VITE_` prefix) | Proxy target hostname (e.g. `nas.local`) |
| `TRUENAS_PORT` | `.env.local` (no `VITE_` prefix) | Proxy target port (e.g. `443`) |
| `VITE_TRUENAS_URL` | `.env.local` | TrueNAS UI base URL for hostname link in ambient strip |
| `VITE_DOZZLE_URL` | `.env.local` | Dozzle iframe base URL; empty = blank iframe (mock mode) |
| `VITE_STOPPED_APP_HIDE_MINUTES` | `.env.local` | Minutes before stopped apps hidden from NAS strip (default 60) |

---

## 9. Uptime Calculation

```
1. nasData.info.uptime_seconds exists → fmtUptime(seconds)
2. fallback → elapsed from session startTime ref (Date.now() at mount)

Output format: "4d" | "12h" | "45m" | "30s"
```

---

## 10. localStorage Keys

| Key | Owner | Contents |
|-----|-------|---------|
| `dashboard:customize` | CustomizePanel | all UI settings object |
| `dashboard:ignored` | App | `[[ignoreKey, label], ...]` tuples |
| `truenas:releaseCache` | TrueNas | `{[image]: {version, fetchedAt}}` (4h TTL) |
| `truenas:stoppedSince` | TrueNas | `[[appName, timestamp], ...]` tuples |
| `truenas:firstSeen:*` | TrueNas | per-issue first-seen timestamps (cpu-temp, pool-cap, etc.) |

---

## 11. Component Roles

| Component | Inputs | Outputs |
|-----------|--------|---------|
| `App.jsx` | state, keyboard, WAN probes | issue assembly, layout switching |
| `services/truenas.js` | `/truenas/api/v2.0/*` poll | `nasData`, `nasIssues()` — pure data, no JSX |
| `CustomizePanel.jsx` | keyboard, localStorage | `[settings, setSettings]` via `useCustomize()` |
| `Dozzle.jsx` | `open` prop, `VITE_DOZZLE_URL` | iframe log viewer overlay |
| `src/data/fixtures.js` | — | static demo issues for healthy/warnings/critical states |
