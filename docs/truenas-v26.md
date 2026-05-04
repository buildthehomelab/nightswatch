# TrueNAS 26 WebSocket API Migration

## Context

TrueNAS 26 completely removes the REST `/api/v2.0` API. No compatibility shims exist. All 12 REST endpoints nightswatch currently calls will return errors the moment the NAS is upgraded. The replacement is JSON-RPC 2.0 over WebSocket at `wss://<host>/api/current`.

---

## What Breaks

Every single TrueNAS data fetch in nightswatch fails. The full list of dead endpoints:

| Current REST call | Replacement method |
|---|---|
| `GET /system/info` | `system.info` |
| `GET /pool` | `pool.query` |
| `GET /app` | `app.query` |
| `POST /reporting/get_data` (cputemp) | `reporting.get_data` |
| `GET /reporting/graphs` | `reporting.netdata_graphs` (name TBC) |
| `POST /reporting/get_data` (disktemp) | `reporting.get_data` |
| `POST /reporting/get_data` (memory/arc_size) | `reporting.get_data` |
| `GET /reporting/graphs` (interface) | `reporting.netdata_graphs` (name TBC) |
| `POST /reporting/get_data` (interface) | `reporting.get_data` |
| `GET /alert/list` | `alert.list` |
| `GET /update/status` | `update.check_available` ⚠️ different name + shape |

**Also broken:** The Vite proxy plugin (`truenasProxyPlugin` in `vite.config.js`) only handles HTTP — it cannot proxy WebSocket connections.

**Auth breaks too:** Currently the API key is injected at the HTTP proxy layer as a `Bearer` header. WebSocket auth is done at the protocol level — you must send an `auth.login_with_api_key` RPC call after the WS handshake. The API key injection point must move.

**What does NOT break:**
- All issue translation logic (`nasIssues()` in truenas.js) — unchanged, depends only on data shapes
- All React UI components — unchanged
- The 60s polling loop in `useTrueNas()` — reusable
- `fmtBytes`, `fmtRate`, `fmtUptime`, `fmtAge` — unchanged
- All the release cache, first-seen tracking, stopped-app tracking logic — unchanged
- GitHub release fetching — unrelated, unchanged

---

## Unknowns / Risks

1. **`reporting` method names in v26** — `reporting.get_data` likely survives but the request shape may differ. `reporting.graphs` may be renamed to `reporting.netdata_graphs`. Verify against v26 API docs at `https://api.truenas.com/`.

2. **`update.check_available` response shape** — current code reads `data.updateStatus?.status?.new_version?.version`. The v26 method likely returns a different structure. Needs verification.

3. **`app.query` response shape** — `app.upgrade_available`, `app.image_updates_available`, `app.active_workloads` field names may differ in v26.

4. **Reporting data schema** — the `aggregations.mean` / `data` array structure the app parses may change.

---

## Approach: Server-side WS bridge in Vite plugin

**Why not expose the key to the browser:** `TRUENAS_KEY` is intentionally not `VITE_`-prefixed. It should stay server-side. Exposing it in the JS bundle is a regression.

**Plan:** Replace the HTTP proxy plugin with a WebSocket bridge plugin in `vite.config.js`. The browser connects to `ws://localhost:PORT/truenas-ws`. The Vite plugin:
1. Accepts the browser WS connection
2. Opens an upstream WS to `wss://TRUENAS_HOST:TRUENAS_PORT/api/current`
3. Authenticates upstream with `auth.login_with_api_key`
4. Passes messages bidirectionally, injecting no other changes

The frontend gets a single `rpc(method, params)` function that wraps this WS connection — it returns a Promise, so the calling code in truenas.js is structurally similar to `fetch()`.

---

## Files to Change

| File | Change |
|---|---|
| `vite.config.js` | Replace HTTP proxy plugin with WS bridge plugin |
| `src/services/truenas.js` | Replace all `fetch()` calls with `rpc()` calls |
| `src/data/mockNas.js` | No change — mock path bypasses fetch entirely |

New file: `src/services/ws.js` — WebSocket JSON-RPC 2.0 client
- Connects to `/truenas-ws` (proxied by Vite to authenticated upstream)
- Exports `rpc(method, params[]) → Promise<result>`
- Handles connect/reconnect, message ID correlation, error propagation
- Singleton connection (reused across all calls)

---

## Implementation Steps

1. **`src/services/ws.js`** (new)
   - `connect()` — creates WS to `/truenas-ws`, resolves when ready
   - `rpc(method, params)` — sends `{"jsonrpc":"2.0","id":N,"method":M,"params":P}`, awaits matching response by id
   - Auto-reconnect with backoff on disconnect

2. **`vite.config.js`** — replace `truenasProxyPlugin` with `truenasWsBridgePlugin`
   - `configureServer(server)` — attach WS handler to Vite's HTTP server on path `/truenas-ws`
   - For each browser connection: open upstream WS → authenticate → bridge messages bidirectionally
   - Keep `TRUENAS_KEY`, `TRUENAS_HOST`, `TRUENAS_PORT` env vars unchanged

3. **`src/services/truenas.js`** — rewrite data fetching
   - `fetchCpuTemp` → `rpc('reporting.get_data', [{graphs:[{name:'cputemp'}]}])`
   - `fetchDiskTemps` → `rpc('reporting.netdata_graphs', [])` then `rpc('reporting.get_data', [...])`
   - `fetchMemStats` → parallel `rpc` for `memory` + `arc_size`
   - `fetchNetStats` → same pattern, interface graph
   - `fetchAlerts` → `rpc('alert.list', [])`
   - `fetchUpdateStatus` → `rpc('update.check_available', [{}])` — response shape needs mapping
   - main fetch: `rpc('system.info', [])`, `rpc('pool.query', [])`, `rpc('app.query', [])`

4. **Response shape mapping** — verify each method's return shape against v26 API docs. `update.check_available` and `app.query` are highest-risk divergences.

---

## Verification

1. `npm run build` — zero errors
2. Dev mode with TrueNAS 26 beta: enable TrueNAS in CustomizePanel → ambient bar populates
3. Browser Network tab → WS connection to `/truenas-ws` established, messages flowing
4. Ambient bar shows hostname, load, cpu, mem, net, apps, pools
5. Issue list populates (alerts, pool status, app states)
6. No deprecation alerts in TrueNAS 26 UI
7. `npm test` — truenas.test.js passes (mock path unaffected)

---

## Not in Scope

- Production nginx proxy config (user's responsibility)
- Real-time event subscriptions (would eliminate polling — future improvement)
- Response shape audit for `update.check_available` / `app.query` — do empirically against a live 26 beta instance
