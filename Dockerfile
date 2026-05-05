# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: dev ──────────────────────────────────────────────────────────────
# Source is volume-mounted at runtime; this stage only provides node_modules.
# docker-compose.yml targets this stage and overrides the command.
FROM deps AS dev

# ── Stage 3: builder ──────────────────────────────────────────────────────────
FROM deps AS builder
COPY index.html vite.config.js eslint.config.js ./
COPY src/ ./src/

# TRUENAS_KEY intentionally absent — must not appear in any build layer.
ARG TRUENAS_HOST
ARG TRUENAS_PORT=443
ARG TRUENAS_STOPPED_APP_HIDE_MINUTES=60
ARG TRUENAS_POOL_WARN_PCT=80
ARG TRUENAS_POOL_CRIT_PCT=90
ARG TRUENAS_DISK_WARN_C=45
ARG TRUENAS_DISK_CRIT_C=55
ARG DOZZLE_URL
ARG WEATHER_LOCATION
ARG CVE_KEYWORDS
ARG DEMO=false

# Set as ENV so loadEnv(mode, cwd, '') reads them from process.env at build time.
ENV TRUENAS_HOST=${TRUENAS_HOST} \
    TRUENAS_PORT=${TRUENAS_PORT} \
    TRUENAS_STOPPED_APP_HIDE_MINUTES=${TRUENAS_STOPPED_APP_HIDE_MINUTES} \
    TRUENAS_POOL_WARN_PCT=${TRUENAS_POOL_WARN_PCT} \
    TRUENAS_POOL_CRIT_PCT=${TRUENAS_POOL_CRIT_PCT} \
    TRUENAS_DISK_WARN_C=${TRUENAS_DISK_WARN_C} \
    TRUENAS_DISK_CRIT_C=${TRUENAS_DISK_CRIT_C} \
    DOZZLE_URL=${DOZZLE_URL} \
    WEATHER_LOCATION=${WEATHER_LOCATION} \
    CVE_KEYWORDS=${CVE_KEYWORDS} \
    DEMO=${DEMO}

RUN npm run build

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/entrypoint.sh /docker-entrypoint-custom.sh
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chmod +x /docker-entrypoint-custom.sh
EXPOSE 80
ENV TRUENAS_HOST="" \
    TRUENAS_PORT="443" \
    TRUENAS_UI_URL="" \
    DEMO="false" \
    WEATHER_LOCATION="" \
    DOZZLE_URL="" \
    CVE_KEYWORDS="" \
    CVE_DAYS_BACK="30" \
    CVE_MIN_CVSS="4.0" \
    POOL_WARN_PCT="80" \
    POOL_CRIT_PCT="90" \
    CPU_WARN_C="70" \
    CPU_CRIT_C="85" \
    DISK_WARN_C="45" \
    DISK_CRIT_C="55" \
    MEM_WARN_PCT="80" \
    MEM_CRIT_PCT="90" \
    LOAD_WARN="4" \
    LOAD_CRIT="8" \
    SCRUB_STALE_DAYS="30" \
    STOPPED_APP_HIDE_MINUTES="60" \
    ENABLE_DOCKER=""
ENTRYPOINT ["/docker-entrypoint-custom.sh"]
CMD ["nginx", "-g", "daemon off;"]
