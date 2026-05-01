import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/truenas': {
        target: 'https://patronus.vaultrona.com:3443',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/truenas/, ''),
        secure: false,
      },
      '/wttr': {
        target: 'https://wttr.in',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/wttr/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'curl/7.88.1');
          });
        },
      },
    },
  },
})
