import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Self-signed HTTPS in dev — camera access (QR scanning) requires a secure
  // context, and browsers don't treat a plain http://<lan-ip> origin as one.
  plugins: [react(), basicSsl()],
  server: {
    // The page is served over https, but the FastAPI backend only speaks
    // plain http — a phone browser silently blocks those API calls as mixed
    // content once loaded from https://<lan-ip>. Proxying here keeps every
    // request the browser makes on the same https origin; Vite forwards it
    // to the backend over http server-side, where mixed-content rules don't
    // apply.
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
