// data.jsx — sample issue data for the homelab dashboard
// Curated to feel real: based on the user's stack
// (*arr, Plex, Pi-hole, Proxmox, TrueNAS, Docker, Nginx, network gear)

const ISSUE_FIXTURES = {
  // ── Healthy: nothing to show ──
  healthy: [],

  // ── Light: a couple of advisories ──
  warnings: [
    {
      id: "certs-jellyfin",
      severity: "warn",
      label: "cert expiring",
      headline: "Jellyfin certificate renews in 6 days.",
      source: "nginx · jellyfin.lan",
      when: "checked 2m ago",
      description:
        "Let's Encrypt auto-renewal is configured but hasn't fired in this window. Worth verifying the cron hook before it lapses.",
      logs: [
        { t: "13:42:02", level: "info", text: "[acme] checking certificate jellyfin.lan" },
        { t: "13:42:02", level: "warn", text: "[acme] expires 2026-05-06 (in 6d 04h)" },
        { t: "13:42:02", level: "info", text: "[acme] next renewal attempt: 2026-05-04 03:00" },
      ],
      actions: ["renew now", "view nginx logs", "silence 24h"],
    },
    {
      id: "updates-docker",
      severity: "info",
      label: "updates pending",
      headline: "11 container images have newer tags.",
      source: "watchtower · 7 stacks",
      when: "checked 14m ago",
      description:
        "Watchtower found newer images for sonarr, radarr, prowlarr, bazarr, jellyseerr, qbittorrent, gluetun, homarr, pihole, unbound, and tailscale.",
      logs: [
        { t: "13:30:11", level: "info", text: "[watchtower] sonarr: 4.0.10 → 4.0.12" },
        { t: "13:30:11", level: "info", text: "[watchtower] radarr: 5.7.0 → 5.8.3" },
        { t: "13:30:11", level: "info", text: "[watchtower] pihole: 2025.07 → 2026.04" },
        { t: "13:30:11", level: "info", text: "[watchtower] +8 more" },
      ],
      actions: ["pull all", "review changes", "snooze 7 days"],
    },
  ],

  // ── Critical: things actively broken ──
  critical: [
    {
      id: "wan-down",
      severity: "crit",
      label: "wan down",
      headline: "Internet connection has been offline for 4 minutes.",
      source: "edgerouter · pppoe0",
      when: "since 13:42",
      description:
        "PPPoE session dropped at 13:42:08. Two reconnect attempts have failed. Pi-hole is still resolving from cache; outbound services are unreachable.",
      logs: [
        { t: "13:42:08", level: "err", text: "[pppoe0] LCP terminated by peer" },
        { t: "13:42:09", level: "warn", text: "[pppoe0] link down" },
        { t: "13:43:11", level: "info", text: "[pppoe0] reconnect attempt 1…" },
        { t: "13:43:42", level: "err", text: "[pppoe0] auth failed: timeout" },
        { t: "13:44:48", level: "info", text: "[pppoe0] reconnect attempt 2…" },
        { t: "13:45:19", level: "err", text: "[pppoe0] auth failed: timeout" },
      ],
      actions: ["restart pppoe", "ping ISP gateway", "ssh edgerouter"],
    },
    {
      id: "smart-tank",
      severity: "crit",
      label: "smart warning",
      headline: "tank/ada2: 3 reallocated sectors detected.",
      source: "truenas · pool tank",
      when: "yesterday 22:14",
      description:
        "Disk ada2 (WD Red 8TB, 4y 2m powered on) reported reallocated sectors in last SMART long test. Pool tank is in mirror config — no data loss, but plan replacement.",
      logs: [
        { t: "Apr 29 22:14", level: "warn", text: "[smartd] device: /dev/ada2 [SAT]" },
        { t: "Apr 29 22:14", level: "err",  text: "[smartd] 5 Reallocated_Sector_Ct: 3 (was 0)" },
        { t: "Apr 29 22:14", level: "warn", text: "[smartd] 197 Current_Pending_Sector: 1" },
        { t: "Apr 29 22:14", level: "info", text: "[zfs] tank/ada2 ONLINE — no errors" },
      ],
      actions: ["run long test", "order replacement", "view pool"],
    },
    {
      id: "disk-media",
      severity: "warn",
      label: "disk space low",
      headline: "/mnt/media is at 94%.",
      source: "truenas · pool tank",
      when: "checked 5m ago",
      description:
        "Sonarr import queue has been growing. 720 GB free of 12 TB. Recommend pruning watched content or expanding the pool.",
      logs: [
        { t: "13:40:00", level: "info", text: "[df] /mnt/media 11.3T used / 12.0T (94%)" },
        { t: "13:40:00", level: "warn", text: "[zfs] capacity threshold 90% exceeded" },
      ],
      actions: ["open sonarr", "run prune", "expand pool"],
    },
    {
      id: "ups",
      severity: "warn",
      label: "ups on battery",
      headline: "Rack UPS switched to battery 38 seconds ago.",
      source: "apc · smart-ups 1500",
      when: "since 13:45",
      description:
        "Line voltage dropped below threshold. 47 minutes of runtime remaining at current load. Auto-shutdown will trigger at 10 minutes.",
      logs: [
        { t: "13:45:31", level: "warn", text: "[apcupsd] OnBattery" },
        { t: "13:45:31", level: "info", text: "[apcupsd] line voltage: 89V" },
        { t: "13:45:31", level: "info", text: "[apcupsd] battery: 100% (47m)" },
      ],
      actions: ["view ups", "test runtime"],
    },
  ],
};

// flatten for "all alerts" mode
ISSUE_FIXTURES.all = [...ISSUE_FIXTURES.critical, ...ISSUE_FIXTURES.warnings];

window.ISSUE_FIXTURES = ISSUE_FIXTURES;
