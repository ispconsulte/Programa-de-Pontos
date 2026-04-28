import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { fileURLToPath } from 'url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const appVersion = process.env.VITE_APP_VERSION || process.env.npm_package_version || 'dev'
const publicSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const publicSupabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const devServerHost = process.env.VITE_DEV_HOST?.trim() || '0.0.0.0'

function versionManifestPlugin() {
  const versionPayload = JSON.stringify({ version: appVersion }, null, 2)

  return {
    name: 'version-manifest',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.end(versionPayload)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionPayload,
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  appType: 'spa',
  root: frontendRoot,
  envDir: path.resolve(frontendRoot, '..'),
  server: {
    host: devServerHost,
    port: 8080,
    proxy: {
      '/users': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
      '/campaign': 'http://localhost:3000',
      '/receivables': 'http://localhost:3000',
      '/clients': 'http://localhost:3000',
      '/contracts': 'http://localhost:3000',
    },
  },
  preview: {
    host: devServerHost,
    port: 8080,
  },
  plugins: [react(), versionManifestPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __PUBLIC_SUPABASE_URL__: JSON.stringify(publicSupabaseUrl),
    __PUBLIC_SUPABASE_ANON_KEY__: JSON.stringify(publicSupabaseAnonKey),
  },
  build: {
    outDir: path.resolve(frontendRoot, '../dist'),
    emptyOutDir: true,
  },
  css: {
    postcss: frontendRoot,
  },
  resolve: {
    alias: {
      '@': path.resolve(frontendRoot, './src'),
    },
  },
}))
