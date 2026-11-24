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
  server: {
    fs: {
      // Bloqueia acesso estático direto a diretórios sensíveis de servidor e backups
      deny: ['.env', '.env.*', '.data/**', 'backups/**', 'server/**', 'supabase/**', 'scripts/**'],
    },
  },
})
