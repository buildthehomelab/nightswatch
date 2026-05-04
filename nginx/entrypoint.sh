#!/bin/sh
set -e

if [ -z "${TRUENAS_HOST}" ]; then
  if [ "${DEMO}" = "true" ]; then
    echo "[nightswatch] TRUENAS_HOST not set — running in DEMO mode" >&2
  else
    echo "[nightswatch] ERROR: TRUENAS_HOST not set (set DEMO=true to run without a NAS)" >&2
    exit 1
  fi
fi
if [ -z "${TRUENAS_KEY}" ] && [ "${DEMO}" != "true" ]; then
  echo "[nightswatch] WARNING: TRUENAS_KEY not set — TrueNAS calls will 401" >&2
fi

# Inject runtime config as a JS global before the React bundle loads.
cat > /usr/share/nginx/html/__nwenv.js <<ENVEOF
window.__NW_ENV__ = {
  DEMO: "${DEMO}",
  WEATHER_LOCATION: "${WEATHER_LOCATION}",
  DOZZLE_URL: "${DOZZLE_URL}",
  CVE_KEYWORDS: "${CVE_KEYWORDS}",
  CVE_DAYS_BACK: "${CVE_DAYS_BACK}",
  CVE_MIN_CVSS: "${CVE_MIN_CVSS}",
  POOL_WARN_PCT: "${POOL_WARN_PCT}",
  POOL_CRIT_PCT: "${POOL_CRIT_PCT}",
  CPU_WARN_C: "${CPU_WARN_C}",
  CPU_CRIT_C: "${CPU_CRIT_C}",
  DISK_WARN_C: "${DISK_WARN_C}",
  DISK_CRIT_C: "${DISK_CRIT_C}",
  MEM_WARN_PCT: "${MEM_WARN_PCT}",
  MEM_CRIT_PCT: "${MEM_CRIT_PCT}",
  LOAD_WARN: "${LOAD_WARN}",
  LOAD_CRIT: "${LOAD_CRIT}",
  SCRUB_STALE_DAYS: "${SCRUB_STALE_DAYS}",
  STOPPED_APP_HIDE_MINUTES: "${STOPPED_APP_HIDE_MINUTES}",
};
ENVEOF

# Explicit var list → envsubst only touches these three.
# nginx's own $uri, $remote_addr, $proxy_add_x_forwarded_for etc. are preserved.
envsubst '${TRUENAS_HOST} ${TRUENAS_PORT} ${TRUENAS_KEY}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[nightswatch] nginx config written (host=${TRUENAS_HOST}, port=${TRUENAS_PORT})"
exec "$@"
