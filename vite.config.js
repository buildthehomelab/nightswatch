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
      hostname: TRUENAS_TARGET,
      port:     TRUENAS_PORT,
      path:     upstreamPath,
      method:   req.method,
      headers: {
        ...fwdHeaders,
        host:          TRUENAS_TARGET,
        authorization: `Bearer ${key ?? ''}`,
      },
      rejectUnauthorized: false,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), basicSsl(), truenasProxyPlugin(env.TRUENAS_KEY)],
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
