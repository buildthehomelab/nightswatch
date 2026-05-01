import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import https from 'node:https'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const truenasUrl = env.TRUENAS_HOST
    ? `https://${env.TRUENAS_HOST}${env.TRUENAS_PORT && env.TRUENAS_PORT !== '443' ? `:${env.TRUENAS_PORT}` : ''}`
    : (env.VITE_TRUENAS_URL ?? '')
  return {
    test: { setupFiles: ['./src/test-setup.js'] },
    define: {
      'import.meta.env.VITE_TRUENAS_URL':              JSON.stringify(truenasUrl),
      'import.meta.env.VITE_POOL_WARN_PCT':            JSON.stringify(env.TRUENAS_POOL_WARN_PCT ?? ''),
      'import.meta.env.VITE_POOL_CRIT_PCT':            JSON.stringify(env.TRUENAS_POOL_CRIT_PCT ?? ''),
      'import.meta.env.VITE_STOPPED_APP_HIDE_MINUTES': JSON.stringify(env.TRUENAS_STOPPED_APP_HIDE_MINUTES ?? ''),
      'import.meta.env.VITE_DOZZLE_URL':               JSON.stringify(env.DOZZLE_URL ?? ''),
      'import.meta.env.VITE_WEATHER_LOCATION':         JSON.stringify(env.WEATHER_LOCATION ?? ''),
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
