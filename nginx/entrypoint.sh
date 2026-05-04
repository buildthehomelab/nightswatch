#!/bin/sh
set -e

if [ -z "${TRUENAS_HOST}" ]; then
  echo "[nightswatch] ERROR: TRUENAS_HOST not set" >&2
  exit 1
fi
if [ -z "${TRUENAS_KEY}" ]; then
  echo "[nightswatch] WARNING: TRUENAS_KEY not set — TrueNAS calls will 401" >&2
fi

# Explicit var list → envsubst only touches these three.
# nginx's own $uri, $remote_addr, $proxy_add_x_forwarded_for etc. are preserved.
envsubst '${TRUENAS_HOST} ${TRUENAS_PORT} ${TRUENAS_KEY}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[nightswatch] nginx config written (host=${TRUENAS_HOST}, port=${TRUENAS_PORT})"
exec "$@"
