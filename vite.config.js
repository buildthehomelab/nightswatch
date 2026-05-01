import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

const TRUENAS_TARGET = 'patronus.vaultrona.com'
const TRUENAS_PORT   = 3443

function truenasProxyPlugin() {
  const key = process.env.TRUENAS_KEY
  if (!key) {
    console.warn('[truenas-proxy] WARNING: TRUENAS_KEY is not set — requests will 401')
  }

  function middleware(req, res) {
    const upstreamPath = req.url.replace(/^\/truenas/, '')
    const proxyReq = https.request({
      hostname: TRUENAS_TARGET,
      port:     TRUENAS_PORT,
      path:     upstreamPath,
      method:   req.method,
      headers: {
        ...req.headers,
        host:          TRUENAS_TARGET,
        authorization: `Bearer ${key ?? ''}`,
      },
      rejectUnauthorized: false,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'content-type':  proxyRes.headers['content-type'] ?? 'application/json',
        'cache-control': proxyRes.headers['cache-control'] ?? 'no-store',
      })
      proxyRes.pipe(res)
    })

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

export default defineConfig({
  plugins: [react(), truenasProxyPlugin()],
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
})
