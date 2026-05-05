import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function truenasProxyPlugin(key, host, port) {
  if (!key)  console.warn('[truenas-proxy] WARNING: TRUENAS_KEY is not set — requests will 401')
  if (!host) console.warn('[truenas-proxy] WARNING: TRUENAS_HOST is not set — proxy will fail')
  const target = host ?? 'localhost'
  const targetPort = Number(port ?? 443)

  function middleware(req, res) {
    const upstreamPath = req.url.replace(/^\/truenas/, '')
    // Strip hop-by-hop and encoding headers; TrueNAS returns plain JSON without them
    const { 'accept-encoding': _ae, connection: _conn, 'transfer-encoding': _te, ...fwdHeaders } = req.headers
    const proxyReq = https.request({
      hostname: target,
      port:     targetPort,
      path:     upstreamPath,
      method:   req.method,
      headers: {
        ...fwdHeaders,
        host:          target,
        authorization: `Bearer ${key ?? ''}`,
      },
      rejectUnauthorized: false,
      timeout: 8000,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('timeout', () => proxyReq.destroy(new Error('upstream timeout')))

    proxyReq.on('error', (err) => {
      console.error('[truenas-proxy] upstream error:', err.message)
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' })
      }
      res.end(JSON.stringify({ error: 'truenas proxy error', detail: err.message }))
    })

    req.pipe(proxyReq)
  }

  return {
    name: 'truenas-proxy',
    configureServer(server)        { server.middlewares.use('/truenas', middleware) },
    configurePreviewServer(server) { server.middlewares.use('/truenas', middleware) },
  }
}

function dockerProxyPlugin(socket, host, port) {
  if (!socket && !host) return { name: 'docker-proxy' };

  function middleware(req, res) {
    const upstreamPath = req.url.replace(/^\/docker/, '');
    const { 'accept-encoding': _ae, connection: _conn, 'transfer-encoding': _te, ...fwdHeaders } = req.headers;

    const options = socket
      ? {
          socketPath: socket,
          path: upstreamPath,
          method: req.method,
          headers: { ...fwdHeaders, host: 'localhost' },
          timeout: 8000,
        }
      : {
          hostname: host,
          port: Number(port ?? 2375),
          path: upstreamPath,
          method: req.method,
          headers: { ...fwdHeaders, host },
          timeout: 8000,
        };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => proxyReq.destroy(new Error('upstream timeout')));
    proxyReq.on('error', (err) => {
      console.error('[docker-proxy] upstream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'docker proxy error', detail: err.message }));
    });

    req.pipe(proxyReq);
  }

  return {
    name: 'docker-proxy',
    configureServer(server)        { server.middlewares.use('/docker', middleware); },
    configurePreviewServer(server) { server.middlewares.use('/docker', middleware); },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const truenasUrl = env.TRUENAS_UI_URL
    ? (env.TRUENAS_UI_URL.startsWith('https://') ? env.TRUENAS_UI_URL : `https://${env.TRUENAS_UI_URL}`)
    : env.TRUENAS_HOST
      ? `https://${env.TRUENAS_HOST}${env.TRUENAS_PORT && env.TRUENAS_PORT !== '443' ? `:${env.TRUENAS_PORT}` : ''}`
      : (env.VITE_TRUENAS_URL ?? '')
  return {
    test: { setupFiles: ['./src/test-setup.js'] },
    define: {
      'import.meta.env.VITE_TRUENAS_URL':              JSON.stringify(truenasUrl),
      'import.meta.env.VITE_POOL_WARN_PCT':            JSON.stringify(env.TRUENAS_POOL_WARN_PCT ?? '80'),
      'import.meta.env.VITE_POOL_CRIT_PCT':            JSON.stringify(env.TRUENAS_POOL_CRIT_PCT ?? '90'),
      'import.meta.env.VITE_STOPPED_APP_HIDE_MINUTES': JSON.stringify(env.TRUENAS_STOPPED_APP_HIDE_MINUTES ?? '60'),
      'import.meta.env.VITE_DISK_WARN_C':              JSON.stringify(env.TRUENAS_DISK_WARN_C ?? '45'),
      'import.meta.env.VITE_DISK_CRIT_C':              JSON.stringify(env.TRUENAS_DISK_CRIT_C ?? '55'),
      'import.meta.env.VITE_SANDBOX_LEFT_URL':          JSON.stringify(env.SANDBOX_LEFT_URL ?? ''),
      'import.meta.env.VITE_SANDBOX_RIGHT_URL':         JSON.stringify(env.SANDBOX_RIGHT_URL ?? ''),
      'import.meta.env.VITE_WEATHER_LOCATION':         JSON.stringify(env.WEATHER_LOCATION ?? ''),
      'import.meta.env.VITE_CVE_KEYWORDS':             JSON.stringify(env.CVE_KEYWORDS ?? ''),
      'import.meta.env.VITE_APP_VERSION':               JSON.stringify(pkg.version),
      'import.meta.env.DEMO':                          JSON.stringify(env.DEMO ?? 'false'),
    },
    plugins: [react(), basicSsl(), truenasProxyPlugin(env.TRUENAS_KEY, env.TRUENAS_HOST, env.TRUENAS_PORT)],
    server: {
      proxy: {
        '/wttr': {
          target: 'https://wttr.in',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/wttr/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('User-Agent', 'curl/7.88.1')
            })
          },
        },
      },
    },
  }
})
