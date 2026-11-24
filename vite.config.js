import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { erpLocalBackendPlugin } from './server/viteBackendPlugin.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    erpLocalBackendPlugin(),
  ],
  optimizeDeps: {
    entries: ['index.html'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@supabase/supabase-js',
    ],
    exclude: ['@electric-sql/pglite'],
  },
  server: {
    watch: {
      ignored: ['**/.data/**', '**/backups/**'],
    },
    fs: {
      // Bloqueia acesso estático direto a diretórios sensíveis de servidor e backups
      deny: ['.env', '.env.*', '.data/**', 'backups/**', 'server/**', 'supabase/**', 'scripts/**'],
    },
  },
})
