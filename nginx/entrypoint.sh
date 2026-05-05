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

# Resolve the browser-facing TrueNAS URL: explicit override > host+port fallback.
if [ -n "${TRUENAS_UI_URL}" ]; then
  _NW_TRUENAS_URL="${TRUENAS_UI_URL}"
elif [ -n "${TRUENAS_HOST}" ]; then
  if [ -z "${TRUENAS_PORT}" ] || [ "${TRUENAS_PORT}" = "443" ]; then
    _NW_TRUENAS_URL="https://${TRUENAS_HOST}"
  else
    _NW_TRUENAS_URL="https://${TRUENAS_HOST}:${TRUENAS_PORT}"
  fi
else
  _NW_TRUENAS_URL=""
fi

# Inject runtime config as a JS global before the React bundle loads.
cat > /usr/share/nginx/html/__nwenv.js <<ENVEOF
window.__NW_ENV__ = {
  DEMO: "${DEMO}",
  TRUENAS_URL: "${_NW_TRUENAS_URL}",
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
  ENABLE_DOCKER: "${ENABLE_DOCKER}",
};
ENVEOF

# Grant nginx worker access to the Docker socket at runtime by matching its GID.
# The socket GID varies per host; detect it dynamically rather than hardcoding 999.
if [ "${ENABLE_DOCKER}" = "true" ] && [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  DOCKER_GROUP=$(getent group "$DOCKER_GID" 2>/dev/null | cut -d: -f1)
  if [ -z "$DOCKER_GROUP" ]; then
    addgroup -g "$DOCKER_GID" dockersock
    DOCKER_GROUP=dockersock
  fi
  adduser nginx "$DOCKER_GROUP" 2>/dev/null || true
  echo "[nightswatch] Docker socket GID=${DOCKER_GID} (group=${DOCKER_GROUP}) granted to nginx worker" >&2
elif [ "${ENABLE_DOCKER}" = "true" ]; then
  echo "[nightswatch] WARNING: ENABLE_DOCKER=true but /var/run/docker.sock not found — mount the socket" >&2
fi

# Explicit var list → envsubst only touches these three.
# nginx's own $uri, $remote_addr, $proxy_add_x_forwarded_for etc. are preserved.
envsubst '${TRUENAS_HOST} ${TRUENAS_PORT} ${TRUENAS_KEY}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[nightswatch] nginx config written (host=${TRUENAS_HOST}, port=${TRUENAS_PORT})"
exec "$@"
