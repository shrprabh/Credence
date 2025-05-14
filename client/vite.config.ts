import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '172.29.213.171',           // Accept connections from all IPs
    port: 5173,                // Or any port you like
  },
})
